import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/lib/supabase/types";
import { REVIEW_THRESHOLD } from "@/lib/ai/schemas";
import { extractFromDocument, extractFromEmail } from "@/lib/ai/extract";
import { scheduleDeadlineAlerts } from "@/lib/alerts/schedule";
import { matchCatalogue, senderDomain, trustedLink } from "@/lib/cancel/links";
import { cycleFromGap, isPeriodic, resolveRenewal } from "@/lib/ingest/schedule";
import { isAdminPilotProvider, learnSender, originalSender } from "@/lib/ingest/sender-learning";
import { CONSUMER_MAIL_DOMAINS } from "@/lib/email/consumer-domains";
import { trackPriceChange } from "@/lib/ingest/price-tracker";
import { PLAN_LIMITS, TRIAL_ALERT_OFFSETS_DAYS } from "@/lib/constants";

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
  { status: "queued"; jobId: string } | { status: "duplicate"; jobId: string };

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

  let result = await extractFromEmail(job.payload);
  // Seconde lecture par le modèle le plus capable quand le rapide écarte un
  // e-mail qui a tout d'une confirmation de résiliation : rare, donc peu
  // coûteux, et un abonnement résilié qui reste suivi fait envoyer de faux
  // rappels.
  if (
    result.data.type === "skip" &&
    CANCELLATION_HINT.test(`${job.payload.subject}
${job.payload.body.slice(0, 6000)}`)
  ) {
    const second = await extractFromEmail(job.payload, { accurate: true });
    result = {
      ...second,
      tokensIn: result.tokensIn + second.tokensIn,
      tokensOut: result.tokensOut + second.tokensOut,
    };
  }
  const { data } = result;

  const common = {
    model_used: result.model,
    tokens_in: result.tokensIn,
    tokens_out: result.tokensOut,
    processed_at: new Date().toISOString(),
    // Ce que l'IA a compris, pour comprendre après coup un e-mail sans effet.
    result: { type: data.type, provider: data.provider, confidence: data.confidence },
  };

  // Email non transactionnel : rien à créer, le job est clos proprement.
  // L'abonnement AdminPilot lui-même est suivi depuis Stripe, jamais relu
  // dans un e-mail : ce serait un doublon.
  // Un achat ponctuel (commande, recharge de crédit, billet) n'est pas un
  // abonnement : il n'a ni échéance ni rappel à suivre. Ses PDF éventuels
  // sont rangés à part, comme documents.
  const oneOffPurchase =
    data.billing_cycle === "one_time" && data.type !== "trial" && data.type !== "price_change";
  // Passage à une formule gratuite (« repassé à la formule Standard ») :
  // rien à payer, rien à suivre. Un essai gratuit, lui, deviendra payant.
  const freePlan = data.amount === 0 && data.type !== "trial" && data.type !== "cancellation";
  if (data.type === "skip" || !data.provider || isAdminPilotProvider(data.provider) || oneOffPurchase || freePlan) {
    await db
      .from("ingestion_jobs")
      .update({ status: "done", ...common })
      .eq("id", job.id);
    return { created: false as const, skipped: true as const };
  }

  const needsReview = data.confidence < REVIEW_THRESHOLD;

  // Confirmation de résiliation envoyée par le fournisseur : l'abonnement
  // passe en « résilié » sans que l'utilisateur ait rien à faire. Seulement
  // sur une lecture assez sûre — retirer à tort un abonnement du suivi
  // ferait manquer ses prochains rappels.
  if (data.type === "cancellation") {
    // Nom exact, sinon un seul abonnement dont le nom commence pareil : la
    // confirmation dit « MyParis Premium », l'utilisateur a saisi « My Paris ».
    const target = needsReview
      ? null
      : ((await findExistingSubscription(db, job.user_id, data.provider)) ??
        (await findSubscriptionByPrefix(db, job.user_id, data.provider)) ??
        (await findSubscriptionBySharedWord(db, job.user_id, data.provider)));
    if (target) {
      await markCancelled(db, job.user_id, target.id, {
        effectiveDate: data.effective_date,
        via: "email",
      });
    }
    await db
      .from("ingestion_jobs")
      .update({ status: needsReview ? "needs_review" : "done", ...common })
      .eq("id", job.id);
    return { created: false as const, cancelled: Boolean(target) };
  }

  // Rapprochement avec un abonnement déjà connu du même fournisseur.
  //
  // Sans lui, chaque facture mensuelle transférée créait une ligne de plus :
  // trois factures Netflix donnaient trois abonnements Netflix, et le total
  // mensuel affiché en tête du tableau de bord — le chiffre pour lequel les
  // gens installent ce produit — triplait. La déduplication par hash de contenu
  // ne protège que du même email renvoyé deux fois, pas de deux factures
  // successives.
  let existing = await findExistingSubscription(
    db,
    job.user_id,
    data.provider,
  );

  // Facture d'un fournisseur dont l'abonnement est marqué résilié.
  if (!existing && !needsReview) {
    const outcome = await chargeAfterCancellation(db, job.user_id, data.provider, job.payload.date);
    if (outcome === "final_invoice") {
      await db
        .from("ingestion_jobs")
        .update({ status: "done", ...common })
        .eq("id", job.id);
      return { created: false as const };
    }
    if (outcome === "reactivated") {
      existing = await findExistingSubscription(db, job.user_id, data.provider);
    }
  }

  // Périodicité et échéance complétées par des règles vérifiables (voir
  // schedule.ts) : l'écart avec la facture précédente du même fournisseur,
  // la date de facture + une période, une échéance passée avancée.
  const previousInvoice = metadataString(existing?.metadata, "last_invoice_date");
  const inferredCycle =
    !isPeriodic(data.billing_cycle) && previousInvoice && data.invoice_date
      ? cycleFromGap(previousInvoice, data.invoice_date)
      : null;
  const cycle = inferredCycle ?? data.billing_cycle;
  // Essai gratuit en cours : la prochaine échéance est sa fin, date du
  // premier prélèvement. Un essai déjà terminé se traite comme le reste.
  const trialEnd = data.type === "trial" ? (data.trial_end ?? data.next_renewal) : null;
  const activeTrial = Boolean(trialEnd && trialEnd >= new Date().toISOString().slice(0, 10));
  const nextRenewal = activeTrial ? trialEnd : resolveRenewal({
    nextRenewal: data.next_renewal,
    cycle: isPeriodic(cycle) ? cycle : (existing?.cycle ?? cycle),
    invoiceDate: data.invoice_date,
  });
  // Un abonnement sans montant ou sans échéance est à vérifier : il ne
  // sert à rien tant que l'utilisateur ne l'a pas complété.
  const confidence =
    data.amount === null || !nextRenewal ? Math.min(data.confidence, 0.6) : data.confidence;

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
  // Expéditeur réel (fournisseur), y compris dans un transfert manuel.
  const realSender = originalSender(job.payload.from, job.payload.body);
  const realDomain = realSender ? senderDomain(realSender) : null;
  const providerDomain =
    realDomain && !CONSUMER_MAIL_DOMAINS.has(realDomain) ? realDomain : null;
  const manageUrl = trustedLink(data.manage_url, [
    catalogue?.domain,
    senderDomain(job.payload.from),
    providerDomain,
  ]);
  // Sans lien « gérer mon abonnement », le site du fournisseur : la page de
  // résiliation y renvoie, l'espace client s'y trouve toujours.
  const siteUrl = providerDomain ? `https://www.${providerDomain}` : null;

  // Changement de prix, comparé AVANT la mise à jour : c'est l'ancien montant
  // qui sert de référence. Seulement sur une extraction assez sûre — alerter
  // d'une hausse lue de travers ferait perdre confiance dans toutes les autres.
  const announcement = data.type === "price_change";
  const priceCheck =
    existing && !needsReview
      ? await trackPriceChange(db, {
          userId: job.user_id,
          subscription: existing,
          newAmount: data.amount,
          currency: data.currency,
          cycle: data.billing_cycle,
          source: announcement ? "announcement" : "invoice",
          previousAmount: data.previous_amount,
          effectiveDate: data.effective_date,
        })
      : null;
  // Montant jugé invraisemblable (un total annuel lu comme un mensuel…) :
  // il ne remplace pas le prix connu, qui reste le plus fiable des deux.
  const implausible =
    priceCheck?.recorded === false &&
    priceCheck.reason === "écart invraisemblable";

  const inserted = existing
    ? await refreshSubscription(db, existing, {
        // Un tarif annoncé ne s'applique qu'à sa date d'effet : le montant
        // connu ne change pas avant la première facture au nouveau prix.
        amount: announcement || implausible ? null : data.amount,
        currency: data.currency,
        cycle,
        category: data.category,
        nextRenewal,
        confidence,
      })
    : await insertSubscription(db, {
        userId: job.user_id,
        provider: data.provider,
        amount: data.amount,
        currency: data.currency,
        cycle,
        category: data.category,
        nextRenewal,
        confidence,
        sourceJobId: job.id,
        overQuota,
        providerId: catalogue?.id ?? null,
        metadata: {
          reasoning: data.reasoning,
          detected_type: data.type,
          ...(manageUrl ? { manage_url: manageUrl } : {}),
          ...(siteUrl ? { site_url: siteUrl } : {}),
          ...(data.invoice_date ? { last_invoice_date: data.invoice_date } : {}),
          ...(activeTrial ? { trial_until: trialEnd } : {}),
        },
      });

  if (existing) {
    await attachLinks(db, existing.id, {
      providerId: catalogue?.id ?? null,
      manageUrl,
      siteUrl,
      lastInvoiceDate: data.invoice_date,
      // Essai en cours : mémorisé. Facture réelle : l'essai est fini.
      trialUntil: activeTrial ? trialEnd : data.type === "trial" ? undefined : null,
    });
  }

  // Une échéance connue vaut une alerte, sauf si l'extraction est trop peu
  // sûre : alerter sur une date inventée est pire que ne pas alerter.
  if (nextRenewal && !needsReview && !overQuota) {
    // Fin d'essai : le piège classique (on oublie, on est prélevé). Rappel
    // 3 jours puis la veille, avec le montant qui va tomber.
    await scheduleDeadlineAlerts(
      activeTrial
        ? {
            userId: job.user_id,
            refType: "subscription",
            refId: inserted.id,
            deadline: nextRenewal,
            title: `Fin de l'essai gratuit ${data.provider}`,
            message:
              data.amount !== null
                ? `${data.amount.toFixed(2).replace(".", ",")} € seront prélevés le ${nextRenewal} si tu ne résilies pas avant.`
                : `Le premier prélèvement aura lieu le ${nextRenewal} si tu ne résilies pas avant.`,
            offsets: TRIAL_ALERT_OFFSETS_DAYS,
          }
        : {
            userId: job.user_id,
            refType: "subscription",
            refId: inserted.id,
            deadline: nextRenewal,
            title: `${data.provider} se renouvelle`,
            message: `Prochaine échéance le ${nextRenewal}.`,
          },
    );
  }

  await db
    .from("ingestion_jobs")
    .update({ status: needsReview ? "needs_review" : "done", ...common })
    .eq("id", job.id);

  // Incomplet : sa facture PDF, peut-être déjà analysée, a les réponses.
  if (data.amount === null || !nextRenewal) {
    await completeFromRecentDocument(db, job.user_id, data.provider);
  }

  // Adresse d'envoi retenue pour enrichir le catalogue, donc le filtre de
  // tous. Seulement sur une lecture sûre d'un fournisseur.
  if (!needsReview) {
    await learnSender(db, {
      userId: job.user_id,
      from: job.payload.from,
      body: job.payload.body,
      provider: data.provider,
      category: data.category,
    });
  }

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
        billing_cycle: data.billing_cycle,
      },
    })
    .select("id")
    .single();

  if (error) throw error;

  // La facture PDF complète l'abonnement du même fournisseur : un e-mail
  // qui dit « votre facture est jointe » sans montant donnait sinon un
  // abonnement vide à côté d'un document qui, lui, avait tout.
  // L'IA classe parfois un contrat en « autre » tout en le nommant
  // « Contrat_… » : le nom qu'elle a choisi fait foi.
  const isContract = data.category === "contrat" || /^contrat_/i.test(data.suggested_name);
  let linkedSubscription = false;
  if (data.provider && !needsReview) {
    linkedSubscription = await completeSubscriptionFromDocument(db, job.user_id, {
      provider: data.provider,
      category: isContract ? "contrat" : data.category,
      amount: data.amount,
      cycle: data.billing_cycle,
      documentDate: data.document_date,
      deadline: data.deadline,
      confidence: data.confidence,
    });
  }

  // La facture d'un abonnement suivi n'a pas besoin de son propre rappel :
  // celui de l'abonnement (prochain prélèvement) le couvre déjà, et deux
  // alertes pour un même paiement font du bruit. Un avis d'impôt, une fin
  // de contrat ou une facture isolée gardent le leur.
  const coveredBySubscription = data.category === "facture" && linkedSubscription;
  if (data.deadline && !needsReview && !coveredBySubscription) {
    await scheduleDeadlineAlerts({
      userId: job.user_id,
      refType: "document",
      refId: inserted.id,
      deadline: data.deadline,
      // Un nom de fichier ne dit pas ce qu'il faut faire : on nomme l'action.
      title:
        isContract && data.provider
          ? `Fin d'engagement ${data.provider}`
          : data.suggested_name,
      message: isContract
        ? `Ton engagement se termine le ${data.deadline} : tu pourras résilier sans frais à partir de cette date.`
        : `Échéance le ${data.deadline}.`,
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
    .replace(
      /\b(sas|sasu|sa|se|sarl|bv|b\.v\.|inc|ltd|llc|gmbh|international)\b/g,
      "",
    )
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/** Tournures d'une confirmation de résiliation (voir la seconde lecture). */
const CANCELLATION_HINT =
  /confirm\w*\s+(?:de\s+)?(?:la\s+|votre\s+)?r[ée]siliation|r[ée]siliation\s+(?:a\s+bien\s+été\s+)?(?:prise\s+en\s+compte|confirm[ée]e|enregistr[ée]e)|confirmation of cancellation|has been cancel+ed/i;

/** Abonnement actif du même fournisseur, s'il en existe un. */
export async function findExistingSubscription(
  db: Db,
  userId: string,
  provider: string,
) {
  const { data } = await db
    .from("subscriptions")
    .select(
      "id, provider, amount, cycle, category, next_renewal, confidence, confirmed_by_user, over_quota, metadata",
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
    // « Inconnu » n'efface pas une périodicité déjà connue.
    if (next.cycle && isPeriodic(next.cycle))
      patch.cycle = next.cycle as TablesUpdate<"subscriptions">["cycle"];
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
export async function exceedsSubscriptionQuota(
  db: Db,
  userId: string,
): Promise<boolean> {
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
 * Passe un abonnement en « résilié » : il sort du total, ses rappels
 * d'échéance automatiques disparaissent (les rappels créés à la main restent),
 * et une ancienne lettre de résiliation en cours de suivi est marquée confirmée.
 */
export async function markCancelled(
  db: Db,
  userId: string,
  subscriptionId: string,
  input: { effectiveDate: string | null; via: "email" | "user" },
) {
  const { data: current } = await db
    .from("subscriptions")
    .select("metadata")
    .eq("id", subscriptionId)
    .eq("user_id", userId)
    .single();
  const metadata =
    current?.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
      ? current.metadata
      : {};

  await db
    .from("subscriptions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      metadata: {
        ...metadata,
        cancelled_via: input.via,
        ...(input.effectiveDate ? { cancel_effective_date: input.effectiveDate } : {}),
      },
    })
    .eq("id", subscriptionId)
    .eq("user_id", userId);

  await db
    .from("alerts")
    .delete()
    .eq("user_id", userId)
    .eq("ref_id", subscriptionId)
    .eq("kind", "deadline")
    .is("sent_at", null);

  await db
    .from("cancellations")
    .update({ status: "confirmed" })
    .eq("subscription_id", subscriptionId)
    .eq("user_id", userId);
}

/** Délai pendant lequel une facture après résiliation est tenue pour la dernière. */
const FINAL_INVOICE_DAYS = 35;

/**
 * Une facture arrive pour un abonnement résilié. Deux cas :
 *  · c'est la dernière facture de la période déjà due — elle date d'avant la
 *    fin d'accès (ou, à défaut de date connue, d'au plus 35 jours après la
 *    résiliation) : on l'ignore ;
 *  · elle est postérieure : la résiliation n'a pas pris, ou l'utilisateur
 *    s'est réabonné. L'abonnement revient dans le suivi et l'utilisateur est
 *    prévenu — être prélevé après avoir résilié est exactement ce qu'il
 *    voulait éviter.
 */
async function chargeAfterCancellation(
  db: Db,
  userId: string,
  provider: string,
  emailDate: string,
): Promise<"none" | "final_invoice" | "reactivated"> {
  const { data } = await db
    .from("subscriptions")
    .select("id, provider, cancelled_at, metadata")
    .eq("user_id", userId)
    .eq("status", "cancelled")
    .order("cancelled_at", { ascending: false });

  const target = normalizeProvider(provider);
  const sub = (data ?? []).find((row) => normalizeProvider(row.provider) === target);
  if (!sub?.cancelled_at) return "none";

  const metadata =
    sub.metadata && typeof sub.metadata === "object" && !Array.isArray(sub.metadata)
      ? (sub.metadata as Record<string, unknown>)
      : {};
  const parsed = new Date(emailDate);
  const received = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const effective =
    typeof metadata.cancel_effective_date === "string"
      ? new Date(`${metadata.cancel_effective_date}T23:59:59Z`)
      : new Date(new Date(sub.cancelled_at).getTime() + FINAL_INVOICE_DAYS * 86_400_000);

  if (received <= effective) return "final_invoice";

  const today = new Date().toISOString().slice(0, 10);
  await db
    .from("subscriptions")
    .update({
      status: "active",
      cancelled_at: null,
      metadata: { ...metadata, reactivated_at: new Date().toISOString() },
    })
    .eq("id", sub.id)
    .eq("user_id", userId);

  await db.from("alerts").upsert(
    {
      user_id: userId,
      ref_type: "subscription",
      ref_id: sub.id,
      kind: "manual",
      title: `${sub.provider} t’a facturé après la résiliation`,
      message:
        "Une nouvelle facture est arrivée alors que cet abonnement était résilié. Si tu ne t’es pas réabonné, la résiliation n’a pas été prise en compte : contacte le fournisseur avec ta confirmation de résiliation.",
      alert_date: today,
      dedup_key: `reprise:${sub.id}:${today}`,
    },
    { onConflict: "dedup_key", ignoreDuplicates: true },
  );

  return "reactivated";
}

/**
 * Complète un abonnement déjà connu : rattachement au catalogue s'il manquait,
 * et dernier lien de gestion vu — une URL de compte peut changer d'une
 * facture à l'autre, la plus récente est la plus sûre.
 */
async function attachLinks(
  db: Db,
  subscriptionId: string,
  links: {
    providerId: string | null;
    manageUrl: string | null;
    siteUrl?: string | null;
    lastInvoiceDate?: string | null;
    /** Date de fin d'essai ; `null` l'efface (essai terminé), absent n'y touche pas. */
    trialUntil?: string | null;
  },
) {
  if (
    !links.providerId &&
    !links.manageUrl &&
    !links.siteUrl &&
    !links.lastInvoiceDate &&
    links.trialUntil === undefined
  ) {
    return;
  }

  const { data: current } = await db
    .from("subscriptions")
    .select("provider_id, metadata")
    .eq("id", subscriptionId)
    .single();
  if (!current) return;

  const patch: TablesUpdate<"subscriptions"> = {};
  if (links.providerId && !current.provider_id)
    patch.provider_id = links.providerId;

  const metadata =
    current.metadata &&
    typeof current.metadata === "object" &&
    !Array.isArray(current.metadata)
      ? current.metadata
      : {};
  // Date de la dernière facture : c'est elle qui permet, à la suivante, de
  // déduire la périodicité. Seulement si elle avance.
  const previous = metadataString(current.metadata, "last_invoice_date");
  const invoiceAdvances =
    links.lastInvoiceDate && (!previous || links.lastInvoiceDate > previous);
  const newSite = links.siteUrl && !metadataString(current.metadata, "site_url");
  const currentTrial = metadataString(current.metadata, "trial_until");
  const trialChange =
    links.trialUntil !== undefined && (links.trialUntil ?? null) !== currentTrial;
  if (links.manageUrl || invoiceAdvances || newSite || trialChange) {
    const base: Record<string, unknown> = { ...(metadata as Record<string, unknown>) };
    if (trialChange) delete base.trial_until;
    patch.metadata = {
      ...base,
      ...(trialChange && links.trialUntil ? { trial_until: links.trialUntil } : {}),
      ...(links.manageUrl ? { manage_url: links.manageUrl } : {}),
      ...(newSite ? { site_url: links.siteUrl } : {}),
      ...(invoiceAdvances ? { last_invoice_date: links.lastInvoiceDate } : {}),
    };
  }
  if (Object.keys(patch).length > 0) {
    await db.from("subscriptions").update(patch).eq("id", subscriptionId);
  }
}

/**
 * Complète l'abonnement suivi d'un fournisseur avec ce que sa facture PDF
 * contient : montant, périodicité, prochaine échéance. Ne remplit que ce qui
 * manque — une valeur déjà connue, a fortiori corrigée par l'utilisateur,
 * n'est jamais écrasée.
 */
async function completeSubscriptionFromDocument(
  db: Db,
  userId: string,
  doc: {
    provider: string;
    category: string;
    amount: number | null;
    cycle: string;
    documentDate: string | null;
    deadline: string | null;
    confidence: number;
  },
): Promise<boolean> {
  // Le nom lu sur un PDF est souvent la raison sociale (« Fitness Park
  // Lyon », « IONOS SE ») : correspondance exacte, puis par préfixe.
  const existing =
    (await findExistingSubscription(db, userId, doc.provider)) ??
    (await findSubscriptionByPrefix(db, userId, doc.provider));
  if (!existing) return false;

  const today = new Date().toISOString().slice(0, 10);
  const patch: TablesUpdate<"subscriptions"> = {};

  const amount = existing.amount ?? doc.amount;
  if (existing.amount === null && doc.amount !== null) patch.amount = doc.amount;

  const cycle = isPeriodic(existing.cycle) ? existing.cycle : doc.cycle;
  if (!isPeriodic(existing.cycle) && isPeriodic(doc.cycle)) {
    patch.cycle = doc.cycle as TablesUpdate<"subscriptions">["cycle"];
  }

  const invoice = doc.category === "facture";
  let renewal = existing.next_renewal;
  if (!renewal && invoice) {
    // Date de facture + une période ; à défaut, l'échéance de paiement de
    // la facture quand elle est à venir (souvent le prochain prélèvement).
    renewal =
      resolveRenewal({ nextRenewal: null, cycle, invoiceDate: doc.documentDate }) ??
      (doc.deadline && doc.deadline >= today ? doc.deadline : null);
    if (renewal) patch.next_renewal = renewal;
  }

  // L'échéance d'un contrat est sa fin d'engagement, pas un prélèvement :
  // gardée à part, elle dit jusqu'à quand on ne peut pas résilier sans frais.
  if (doc.category === "contrat" && doc.deadline && doc.deadline >= today) {
    const metadata =
      existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? existing.metadata
        : {};
    if (!metadataString(existing.metadata, "commitment_end")) {
      patch.metadata = { ...metadata, commitment_end: doc.deadline };
    }
  }

  // Désormais complet : il n'a plus de raison de rester « à vérifier ».
  if (!existing.confirmed_by_user && amount !== null && renewal && isPeriodic(cycle)) {
    patch.confidence = Math.max(existing.confidence, Math.min(doc.confidence, 0.95));
  }

  if (Object.keys(patch).length === 0) return true;
  await db.from("subscriptions").update(patch).eq("id", existing.id);

  if (patch.next_renewal && !existing.over_quota) {
    await scheduleDeadlineAlerts({
      userId,
      refType: "subscription",
      refId: existing.id,
      deadline: patch.next_renewal,
      title: `${existing.provider} se renouvelle`,
      message: `Prochaine échéance le ${patch.next_renewal}.`,
    });
  }
  return true;
}

async function findSubscriptionByPrefix(db: Db, userId: string, provider: string) {
  const target = normalizeProvider(provider);
  if (target.length < 4) return null;
  const { data } = await db
    .from("subscriptions")
    .select(
      "id, provider, amount, cycle, category, next_renewal, confidence, confirmed_by_user, over_quota, metadata",
    )
    .eq("user_id", userId)
    .eq("status", "active");
  const matches = (data ?? []).filter((row) => {
    const name = normalizeProvider(row.provider);
    return name.length >= 4 && (name.startsWith(target) || target.startsWith(name));
  });
  // Ambigu (deux abonnements possibles) : on ne devine pas.
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Dernier recours pour une résiliation : un seul abonnement actif partage un
 * mot d'au moins quatre lettres avec le nom lu (« Paris Saint-Germain » ↔
 * « My Paris »). Deux candidats : on ne devine pas. Au pire, l'utilisateur
 * clique « Reprendre le suivi ».
 */
async function findSubscriptionBySharedWord(db: Db, userId: string, provider: string) {
  const words = (name: string) =>
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4);
  const wanted = new Set(words(provider));
  if (!wanted.size) return null;
  const { data } = await db
    .from("subscriptions")
    .select("id, provider")
    .eq("user_id", userId)
    .eq("status", "active");
  const matches = (data ?? []).filter((row) => words(row.provider).some((word) => wanted.has(word)));
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Au moment où l'abonnement est créé ou mis à jour depuis un e-mail, sa
 * facture PDF a peut-être déjà été analysée (ordre de traitement, nouvel
 * essai) : on la retrouve pour compléter.
 */
async function completeFromRecentDocument(db: Db, userId: string, provider: string) {
  const { data: docs } = await db
    .from("documents")
    .select("category, confidence, deadline, extracted_data")
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 2 * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(20);
  const target = normalizeProvider(provider);
  const doc = (docs ?? []).find((row) => {
    const name = normalizeProvider(metadataString(row.extracted_data, "provider") ?? "");
    return name.length >= 3 && (name === target || name.startsWith(target) || target.startsWith(name));
  });
  if (!doc) return;
  const extracted = doc.extracted_data as Record<string, unknown>;
  await completeSubscriptionFromDocument(db, userId, {
    provider,
    category: doc.category,
    amount: typeof extracted.amount === "number" ? extracted.amount : null,
    cycle: typeof extracted.billing_cycle === "string" ? extracted.billing_cycle : "unknown",
    documentDate: metadataString(extracted, "document_date"),
    deadline: doc.deadline,
    confidence: doc.confidence,
  });
}

/** Valeur texte d'une clé des métadonnées JSON, ou `null`. */
function metadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
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
