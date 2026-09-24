import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { REVIEW_THRESHOLD } from "@/lib/ai/schemas";
import { extractFromDocument, extractFromEmail } from "@/lib/ai/extract";
import { scheduleDeadlineAlerts } from "@/lib/alerts/schedule";

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
 * Réserve un lot de jobs en attente.
 *
 * Le passage en `processing` est fait avant tout travail : deux exécutions
 * concurrentes du drain ne peuvent pas traiter le même job deux fois.
 */
export async function claimPendingJobs(limit = 10) {
  const db = createAdminClient();

  const { data: candidates, error } = await db
    .from("ingestion_jobs")
    .select("id")
    .in("status", ["pending", "failed"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!candidates?.length) return [];

  const { data: claimed, error: claimError } = await db
    .from("ingestion_jobs")
    .update({ status: "processing" })
    .in(
      "id",
      candidates.map((c) => c.id),
    )
    .in("status", ["pending", "failed"]) // perd la course => n'est pas réservé
    .select("*");

  if (claimError) throw claimError;
  return claimed ?? [];
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

  const { data: inserted, error } = await db
    .from("subscriptions")
    .insert({
      user_id: job.user_id,
      provider: data.provider,
      amount: data.amount,
      currency: data.currency,
      cycle: data.billing_cycle,
      category: data.category,
      next_renewal: data.next_renewal,
      confidence: data.confidence,
      source_job_id: job.id,
      metadata: { reasoning: data.reasoning, detected_type: data.type },
    })
    .select("id")
    .single();

  if (error) throw error;

  // Une échéance connue vaut une alerte, sauf si l'extraction est trop peu
  // sûre : alerter sur une date inventée est pire que ne pas alerter.
  if (data.next_renewal && !needsReview) {
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
