import { NextResponse } from "next/server";

import { isAiConfigured } from "@/lib/ai/client";
import { isMockMode } from "@/lib/ai/mock";
import {
  claimPendingJobs,
  markFailed,
  processDocumentJob,
  processEmailJob,
} from "@/lib/ingest/pipeline";
import { wakeDrain } from "@/lib/ingest/wake";
import { deleteRaw, getRaw } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Drain de la file d'ingestion.
 *
 * Déclenché par la route d'ingestion juste après chaque réception (latence
 * quasi nulle) et par un cron de rattrapage. Les deux peuvent se chevaucher
 * sans risque : `claimPendingJobs` réserve les jobs avant tout traitement.
 *
 * Les jobs sont traités en séquence, pas en parallèle : le volume est faible,
 * et la séquence garde les erreurs lisibles et le coût IA prévisible.
 */

const BATCH_SIZE = 10;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function drain() {
  // Sans modèle configuré, chaque job échouait aussitôt et restait `failed`
  // pour toujours : les emails reçus avant la pose de la clé étaient perdus.
  // On les laisse en file ; le premier passage après configuration les traite.
  if (!isAiConfigured() && !isMockMode()) {
    return { claimed: 0, processed: 0, failed: 0, waiting: "ai_not_configured" };
  }

  const jobs = await claimPendingJobs(BATCH_SIZE);
  let processed = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      if (!job.raw_url) throw new Error("job sans document stocké");

      const raw = await getRaw(job.raw_url);

      if (job.source === "email") {
        const payload = JSON.parse(
          Buffer.from(raw.base64, "base64").toString("utf8"),
        );
        const result = await processEmailJob({
          id: job.id,
          user_id: job.user_id,
          attempts: job.attempts,
          payload,
        });
        // E-mail sans rapport avec un abonnement (newsletter, message
        // personnel capté par un filtre) : effacé tout de suite plutôt que
        // gardé 30 jours. Minimisation (art. 5 du RGPD) : rien n'en a été
        // extrait, il n'y a rien à rejouer.
        if ("skipped" in result && result.skipped) {
          await deleteRaw(job.raw_url).catch(() => {});
          await createAdminClient()
            .from("ingestion_jobs")
            .update({ raw_url: null })
            .eq("id", job.id);
        }
      } else {
        await processDocumentJob({
          id: job.id,
          user_id: job.user_id,
          mime_type: job.mime_type ?? raw.contentType,
          raw_url: job.raw_url,
          payload: {
            base64: raw.base64,
            // La clé de stockage est un hash : sans le nom d'origine, l'utilisateur ne
            // reconnaîtrait pas son document et le modèle perdrait un indice.
            filename: job.original_filename ?? "document",
          },
        });
      }
      processed += 1;
    } catch (error) {
      // Un job en échec ne doit jamais interrompre le lot : les suivants
      // n'ont rien à voir avec lui.
      await markFailed(job.id, job.attempts, error);
      failed += 1;
    }
  }

  return { claimed: jobs.length, processed, failed };
}

/**
 * Lot plein : il en reste sans doute (import de l'historique, plusieurs
 * dizaines d'e-mails d'un coup). On relance un passage juste après la
 * réponse, au lieu d'attendre la tâche planifiée du lendemain.
 */
async function drainAndChain(request: Request) {
  const result = await drain();
  if ("claimed" in result && result.claimed === BATCH_SIZE) wakeDrain(request.url);
  return result;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }
  return NextResponse.json(await drainAndChain(request));
}

/** Vercel Cron appelle en GET. */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }
  return NextResponse.json(await drainAndChain(request));
}
