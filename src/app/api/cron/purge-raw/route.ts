import { NextResponse } from "next/server";

import { RAW_RETENTION_DAYS, REFERRAL } from "@/lib/constants";
import { deleteRaw } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Purge des documents bruts au-delà de la durée de rétention.
 *
 * Obligation RGPD de minimisation : une fois les données structurées extraites,
 * l'email d'origine n'a plus d'utilité. On garde trente jours pour pouvoir
 * rejouer une extraction ratée, puis on supprime.
 *
 * Ce cron est ce qui rend la politique de confidentialité vraie. Sans lui, la
 * promesse « nous ne conservons pas vos emails » serait un mensonge.
 *
 * Seuls les bruts d'EMAIL sont purgés : un document uploadé est le bien de
 * l'utilisateur, il reste dans son coffre-fort jusqu'à ce qu'il le supprime.
 */

const BATCH_SIZE = 200;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }

  const db = createAdminClient();
  const cutoff = new Date(
    Date.now() - RAW_RETENTION_DAYS * 86_400_000,
  ).toISOString();

  const { data: jobs, error } = await db
    .from("ingestion_jobs")
    .select("id, raw_url")
    .eq("source", "email")
    .not("raw_url", "is", null)
    // Un job encore en attente ou en échec n'a pas livré sa donnée : le purger
    // reviendrait à perdre définitivement l'email sans rien en avoir extrait.
    .in("status", ["done", "needs_review"])
    .lt("created_at", cutoff)
    .limit(BATCH_SIZE);

  if (error) throw error;

  let purged = 0;

  for (const job of jobs ?? []) {
    try {
      await deleteRaw(job.raw_url!);
      // `raw_url` à null marque la purge : le job reste comme trace d'ingestion
      // et empêche un nouveau traitement du même contenu.
      await db
        .from("ingestion_jobs")
        .update({ raw_url: null })
        .eq("id", job.id);
      purged += 1;
    } catch {
      // Ignoré : le prochain passage réessaiera.
    }
  }

  await db.rpc("purge_rate_limits");

  // Empreintes d'IP du parrainage : utiles 30 jours pour repérer les
  // inscriptions en série, puis effacées comme l'annonce la politique de
  // confidentialité.
  await db
    .from("referrals")
    .update({ ip_hash: null })
    .not("ip_hash", "is", null)
    .lt(
      "created_at",
      new Date(Date.now() - REFERRAL.ipRetentionDays * 86_400_000).toISOString(),
    );

  return NextResponse.json({ candidates: jobs?.length ?? 0, purged });
}
