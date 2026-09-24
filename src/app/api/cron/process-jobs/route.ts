import { NextResponse } from "next/server";

import {
  claimPendingJobs,
  markFailed,
  processDocumentJob,
  processEmailJob,
} from "@/lib/ingest/pipeline";
import { getRaw } from "@/lib/storage";

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
        await processEmailJob({
          id: job.id,
          user_id: job.user_id,
          attempts: job.attempts,
          payload,
        });
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

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }
  return NextResponse.json(await drain());
}

/** Vercel Cron appelle en GET. */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }
  return NextResponse.json(await drain());
}
