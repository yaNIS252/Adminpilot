import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/lib/supabase/types";
import { REVIEW_THRESHOLD } from "@/lib/ai/schemas";
import { extractFromDocument, extractFromEmail } from "@/lib/ai/extract";
import { scheduleDeadlineAlerts } from "@/lib/alerts/schedule";
import { matchCatalogue, senderDomain, trustedLink } from "@/lib/cancel/links";
import { PLAN_LIMITS } from "@/lib/constants";

/**
 * Cœur du pipeline. Les deux sources — mail transféré et document uploadé —
 * convergent ici : un seul chemin à construire, tester et fiabiliser.
 *
 * Toutes les écritures passent par le client service role, qui contourne les
 * policies RLS. Chaque requête filtre donc explicitement sur `user_id` : à ce
 * niveau, plus aucun garde-fou de la base ne joue.
 */

/** Au-delà, on cesse de réessayer : l'échec est structurel, pas transitoire. */
const MAX_ATTEMPTS = 3;

export type EnqueueInput = {
  userId: string;
  source: "email" | "upload";
  contentHash: string;
  rawUrl: string;
  mimeType: string;
  /**
   * Nom de fichier d'origine. La clé de stockage dérive du hash de contenu, donc
   * sans ça le nom que l'utilisateur reconnaît serait définitivement perdu.
   */
  originalFilename?: string;
};

export type EnqueueResult =
  | { status: "queued"; jobId: string }
  | { status: "duplicate"; jobId: string };

/**
 * Dépose un job et rend la main immédiatement — l'appelant répond 202.
 *
 * La contrainte `unique(user_id, content_hash)` EST le mécanisme d'idempotence :
 * rejouer la même réception n'a aucun effet, ce qui rend les retours d'erreur
 * de la route d'ingestion sans conséquence.
 */
export async function enqueue(input: EnqueueInput): Promise<EnqueueResult> {
  const db = createAdminClient();

  const { data, error } = await db
    .from("ingestion_jobs")
    .insert({
      user_id: input.userId,
      source: input.source,
      content_hash: input.contentHash,
      raw_url: input.rawUrl,
      mime_type: input.mimeType,
      original_filename: input.originalFilename ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = violation d'unicité : déjà reçu, ce n'est pas une erreur.
    if (error.code === "23505") {
      const { data: existing } = await db
        .from("ingestion_jobs")
        .select("id")
        .eq("user_id", input.userId)
        .eq("content_hash", input.contentHash)
        .single();

      return { status: "duplicate", jobId: existing?.id ?? "" };
    }
    throw error;
  }

  return { status: "queued", jobId: data.id };
}

/**
 * Délai au-delà duquel un job resté `processing` est considéré abandonné.
 *
 * Très supérieur au `maxDuration` de la route de drain (60 s) : reprendre un
 * job qu'une exécution encore vivante est en train de traiter doublerait
 * l'appel au modèle et créerait deux lignes pour un seul document.
 */
const STALE_CLAIM_SECONDS = 900;

/**
 * Réserve un lot de jobs traitables.
 *
 * Toute la réservation tient dans une fonction Postgres à `for update skip
 * locked` : deux drains concurrents ne voient jamais les mêmes lignes, et la
 * reprise d'un job abandonné consomme une tentative.
 *
 * Sont repris les jobs `pending`, `failed`, et ceux restés `processing` au-delà
 * du délai. Sans ce dernier cas, une exécution tuée en plein vol laissait le
 * job figé pour toujours : l'utilisateur voyait son document partir et ne
 * jamais arriver, sans la moindre erreur nulle part.
 */
export async function claimPendingJobs(limit = 10) {
  const db = createAdminClient();

  const { data, error } = await db.rpc("claim_ingestion_jobs", {
    p_limit: limit,
    p_max_attempts: MAX_ATTEMPTS,
    p_stale_seconds: STALE_CLAIM_SECONDS,
  });

  if (error) throw error;
  return data ?? [];
}

/** Consigne un échec. Le job repart en file tant que le quota d'essais tient. */
export async function markFailed(
  jobId: string,
  attempts: number,
  error: unknown,
) {
  const db = createAdminClient();
  const message = error instanceof Error ? error.message : String(error);

  await db
    .from("ingestion_jobs")
    .update({
      status: "failed",
      attempts: attempts + 1,
      // Message d'erreur seulement : jamais le contenu du document.
      error: message.slice(0, 500),
    })
    .eq("id", jobId);
}

/**
 * Traite un email déjà stocké et crée l'abonnement correspondant.
 *
 * Une extraction peu sûre n'est jamais présentée comme acquise : le job part en
 * `needs_review` et la ligne reste `confirmed_by_user = false`, ce qui interdit
 * toute action irréversible dessus.
 */
export async function processEmailJob(job: {
  id: string;
  user_id: string;
  attempts: number;
  payload: { from: string; subject: string; date: string; body: string };
}) {
  const db = createAdminClient();

  const result = await extractFromEmail(job.payload);
  const { data } = result;

  const common = {
    model_used: result.model,
    tokens_in: result.tokensIn,
    tokens_out: result.tokensOut,
    processed_at: new Date().toISOString(),
  };

  // Email non transactionnel : rien à créer, le job est clos proprement.
  if (data.type === "skip" || !data.provider) {
    await db
      .from("ingestion_jobs")
      .update({ status: "done", ...common })
      .eq("id", job.id);
    return { created: false as const };
  }

  const needsReview = data.confidence < REVIEW_THRESHOLD;

  // Rapprochement avec un abonnement déjà connu du même fournisseur.
  //
  // Sans lui, chaque facture mensuelle transférée créait une ligne de plus :
  // trois factures Netflix donnaient trois abonnements Netflix, et le total
  // mensuel affiché en tête du tableau de bord — le chiffre pour lequel les
  // gens installent ce produit — triplait. La déduplication par hash de contenu
  // ne protège que du même email renvoyé deux fois, pas de deux factures
  // successives.
  const existing = await findExistingSubscription(
    db,
    job.user_id,
    data.provider,
  );

  // Au-delà du quota de la formule, l'abonnement est enregistré mais masqué.
  // Une mise à jour d'un abonnement déjà connu ne change jamais ce statut : un
  // abonnement visible le reste, un abonnement en réserve aussi.
  const overQuota = existing
    ? existing.over_quota
    : await exceedsSubscriptionQuota(db, job.user_id);

  // Rattachement au catalogue (base légale, lien officiel de résiliation) et
  // lien « gérer mon abonnement » de l'e-mail, gardé seulement s'il mène au
  // domaine du fournisseur ou de l'expéditeur.
  const catalogue = await matchCatalogue(db, {
    provider: data.provider,
    from: job.payload.from,
  });
  const manageUrl = trustedLink(data.manage_url, [
    catalogue?.domain,
    senderDomain(job.payload.from),
  ]);

  const inserted = existing
    ? await refreshSubscription(db, existing, {
        amount: data.amount,
        currency: data.currency,
        cycle: data.billing_cycle,
        category: data.category,
        nextRenewal: data.next_renewal,
        confidence: data.confidence,
      })
    : await insertSubscription(db, {
        userId: job.user_id,
        provider: data.provider,
        amount: data.amount,
        currency: data.currency,
        cycle: data.billing_cycle,
        category: data.category,
        nextRenewal: data.next_renewal,
        confidence: data.confidence,
        sourceJobId: job.id,
        overQuota,
        providerId: catalogue?.id ?? null,
        metadata: {
          reasoning: data.reasoning,
          detected_type: data.type,
          ...(manageUrl ? { manage_url: manageUrl } : {}),
        },
      });

  if (existing) {
    await attachLinks(db, existing.id, {
      providerId: catalogue?.id ?? null,
      manageUrl,
    });
  }

  // Une échéance connue vaut une alerte, sauf si l'extraction est trop peu
  // sûre : alerter sur une date inventée est pire que ne pas alerter.
  if (data.next_renewal && !needsReview && !overQuota) {
    await scheduleDeadlineAlerts({
      userId: job.user_id,
      refType: "subscription",
      refId: inserted.id,
      deadline: data.next_renewal,
      title: `${data.provider} se renouvelle`,
      message: `Prochaine échéance le ${data.next_renewal}.`,
    });
  }

  await db
    .from("ingestion_jobs")
    .update({ status: needsReview ? "needs_review" : "done", ...common })
    .eq("id", job.id);

  return { created: true as const, subscriptionId: inserted.id, needsReview };
}

/** Même logique pour un document : extraction, puis écriture avec confiance. */
export async function processDocumentJob(job: {
  id: string;
  user_id: string;
  mime_type: string;
  raw_url: string;
  payload: { base64: string; filename: string };
}) {
  const db = createAdminClient();

  // Seconde vérification du quota, au moment de l'analyse : des envois
  // simultanés peuvent tous passer le contrôle de la route d'upload avant
  // qu'aucun ne soit compté. Refuser ici évite aussi de payer l'appel au
  // modèle pour un document qui ne serait pas conservé.
  if (await exceedsDocumentQuota(db, job.user_id)) {
    await db
      .from("ingestion_jobs")
      .update({
        status: "failed",
        // Au-delà du nombre d'essais : le job ne sera jamais repris.
        attempts: MAX_ATTEMPTS,
        error: "quota de documents atteint",
        processed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { documentId: null, needsReview: false, overQuota: true as const };
  }

  const result = await extractFromDocument({
    base64: job.payload.base64,
    mimeType: job.mime_type,
    filename: job.payload.filename,
  });
  const { data } = result;
  const needsReview = data.confidence < REVIEW_THRESHOLD;

  const { data: inserted, error } = await db
    .from("documents")
    .insert({
      user_id: job.user_id,
      file_url: job.raw_url,
      mime_type: job.mime_type,
      filename_original: job.payload.filename,
      filename_ai: data.suggested_name,
      category: data.category,
      deadline: data.deadline,
      confidence: data.confidence,
      source_job_id: job.id,
      extracted_data: {
        provider: data.provider,
        amount: data.amount,
        currency: data.currency,
        document_date: data.document_date,
        reference: data.reference,
      },
    })
    .select("id")
    .single();

  if (error) throw error;

  if (data.deadline && !needsReview) {
    await scheduleDeadlineAlerts({
      userId: job.user_id,
      refType: "document",
      refId: inserted.id,
      deadline: data.deadline,
      title: data.suggested_name,
      message: `Échéance le ${data.deadline}.`,
    });
  }

  await db
    .from("ingestion_jobs")
    .update({
      status: needsReview ? "needs_review" : "done",
      model_used: result.model,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      processed_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  return { documentId: inserted.id, needsReview };
}

// ---------------------------------------------------------------- rapprochement

type Db = ReturnType<typeof createAdminClient>;

/**
 * Forme comparable d'un nom de fournisseur.
 *
 * « Netflix », « NETFLIX.COM » et « Netflix International B.V. » désignent le
 * même abonnement pour l'utilisateur. Sans normalisation, la comparaison stricte
 * les traiterait comme trois fournisseurs distincts et le rapprochement ne
 * servirait à rien.
 */
function normalizeProvider(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(sas|sasu|sa|sarl|bv|b\.v\.|inc|ltd|llc|gmbh|international)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/** Abonnement actif du même fournisseur, s'il en existe un. */
async function findExistingSubscription(
  db: Db,
  userId: string,
  provider: string,
) {
  const { data } = await db
    .from("subscriptions")
    .select(
      "id, provider, amount, cycle, next_renewal, confidence, confirmed_by_user, over_quota",
    )
    .eq("user_id", userId)
    .eq("status", "active");

  const target = normalizeProvider(provider);
  return (
    (data ?? []).find((row) => normalizeProvider(row.provider) === target) ??
    null
  );
}

type Extraction = {
  amount: number | null;
  currency: string;
  cycle: string;
  category: string | null;
  nextRenewal: string | null;
  confidence: number;
};

/**
 * Met à jour un abonnement existant à partir d'une nouvelle facture.
 *
 * Deux règles, et elles comptent autant l'une que l'autre :
 *
 *  · une ligne corrigée à la main par l'utilisateur n'est jamais écrasée par le
 *    modèle. Voir sa correction défaite par la machine est le genre de détail
 *    qui fait désinstaller un produit ;
 *  · une extraction moins sûre que celle déjà en place ne la remplace pas. Une
 *    facture mal océrisée ne doit pas dégrader une donnée déjà fiable.
 *
 * L'échéance fait exception : une date postérieure à celle connue est une
 * information neuve, pas une correction, et elle est donc retenue même sur une
 * ligne confirmée.
 */
async function refreshSubscription(
  db: Db,
  existing: {
    id: string;
    amount: number | null;
    cycle: string;
    next_renewal: string | null;
    confidence: number;
    confirmed_by_user: boolean;
  },
  next: Extraction,
): Promise<{ id: string }> {
  const patch: TablesUpdate<"subscriptions"> = {};

  const dateAvance =
    next.nextRenewal &&
    (!existing.next_renewal || next.nextRenewal > existing.next_renewal);
  if (dateAvance) patch.next_renewal = next.nextRenewal;

  if (!existing.confirmed_by_user && next.confidence >= existing.confidence) {
    if (next.amount !== null) patch.amount = next.amount;
    if (next.currency) patch.currency = next.currency;
    if (next.cycle) patch.cycle = next.cycle as TablesUpdate<"subscriptions">["cycle"];
    if (next.category) patch.category = next.category;
    patch.confidence = next.confidence;
  }

  if (Object.keys(patch).length) {
    await db.from("subscriptions").update(patch).eq("id", existing.id);
  }

  return { id: existing.id };
}

/**
 * Vrai si un nouvel abonnement dépasserait le quota de la formule.
 *
 * Seuls les abonnements VISIBLES comptent : ceux déjà en réserve ne doivent
 * pas empêcher l'utilisateur de retrouver sa place s'il en supprime un.
 */
async function exceedsSubscriptionQuota(db: Db, userId: string): Promise<boolean> {
  const { data: profile } = await db
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  const limit = PLAN_LIMITS[profile?.plan ?? "free"].subscriptions;
  if (limit === null) return false;

  const { count } = await db
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("over_quota", false);

  return (count ?? 0) >= limit;
}

/** Vrai si le compte a déjà autant de documents que sa formule en permet. */
async function exceedsDocumentQuota(db: Db, userId: string): Promise<boolean> {
  const { data: profile } = await db
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  const limit = PLAN_LIMITS[profile?.plan ?? "free"].documents;
  if (limit === null) return false;

  const { count } = await db
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return (count ?? 0) >= limit;
}

/**
 * Complète un abonnement déjà connu : rattachement au catalogue s'il manquait,
 * et dernier lien de gestion vu — une URL de compte peut changer d'une
 * facture à l'autre, la plus récente est la plus sûre.
 */
async function attachLinks(
  db: Db,
  subscriptionId: string,
  links: { providerId: string | null; manageUrl: string | null },
) {
  if (!links.providerId && !links.manageUrl) return;

  const { data: current } = await db
    .from("subscriptions")
    .select("provider_id, metadata")
    .eq("id", subscriptionId)
    .single();
  if (!current) return;

  const patch: TablesUpdate<"subscriptions"> = {};
  if (links.providerId && !current.provider_id) patch.provider_id = links.providerId;
  if (links.manageUrl) {
    const metadata =
      current.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
        ? current.metadata
        : {};
    patch.metadata = { ...metadata, manage_url: links.manageUrl };
  }
  if (Object.keys(patch).length > 0) {
    await db.from("subscriptions").update(patch).eq("id", subscriptionId);
  }
}

async function insertSubscription(
  db: Db,
  input: {
    userId: string;
    provider: string;
    amount: number | null;
    currency: string;
    cycle: string;
    category: string | null;
    nextRenewal: string | null;
    confidence: number;
    sourceJobId: string;
    overQuota: boolean;
    providerId: string | null;
    metadata: Record<string, unknown>;
  },
): Promise<{ id: string }> {
  const { data, error } = await db
    .from("subscriptions")
    .insert({
      user_id: input.userId,
      provider: input.provider,
      amount: input.amount,
      currency: input.currency,
      cycle: input.cycle as never,
      category: input.category,
      next_renewal: input.nextRenewal,
      confidence: input.confidence,
      source_job_id: input.sourceJobId,
      over_quota: input.overQuota,
      provider_id: input.providerId,
      metadata: input.metadata as never,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}
