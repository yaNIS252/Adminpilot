import { NextResponse } from "next/server";

import { missingLegalFields } from "@/lib/legal";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * État de santé du service, protégé par le secret des tâches planifiées.
 *
 * Répond en un appel aux questions qu'on se pose quand « rien n'arrive » :
 * qu'est-ce qui est configuré, la base répond-elle, des e-mails attendent-ils
 * leur analyse, et depuis quand. Ne renvoie jamais une valeur secrète, seulement
 * sa présence.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }

  const configured = {
    ai: Boolean(process.env.ANTHROPIC_API_KEY) || process.env.ADMINPILOT_AI_MODE === "mock",
    email_sending: Boolean(process.env.RESEND_API_KEY),
    inbound_webhook_secret: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    sentry: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
    site_url: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    inbound_domain: process.env.INBOUND_DOMAIN ?? null,
  };

  const db = createAdminClient();
  const started = Date.now();
  const [pending, failed, oldest, lastReceived] = await Promise.all([
    db.from("ingestion_jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("ingestion_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    db
      .from("ingestion_jobs")
      .select("created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    db
      .from("ingestion_jobs")
      .select("created_at")
      .eq("source", "email")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const database = !pending.error;
  const problems = [
    !configured.ai && "clé d'IA absente : les e-mails reçus restent en attente",
    !configured.email_sending && "clé Resend absente : aucune alerte ne part",
    !configured.stripe && "Stripe incomplet : paiement impossible",
    !database && "base de données injoignable",
    (failed.count ?? 0) > 0 && `${failed.count} tâche(s) d'analyse en échec`,
    missingLegalFields().length > 0 &&
      `mentions légales incomplètes : ${missingLegalFields().join(", ")}`,
  ].filter(Boolean);

  return NextResponse.json(
    {
      ok: problems.length === 0,
      problems,
      configured,
      database: { reachable: database, latency_ms: Date.now() - started },
      ingestion: {
        pending: pending.count ?? 0,
        failed: failed.count ?? 0,
        oldest_pending_at: oldest.data?.created_at ?? null,
        // Si ce champ ne bouge plus alors que des e-mails sont transférés,
        // c'est la réception (webhook Resend) qui est coupée.
        last_email_received_at: lastReceived.data?.created_at ?? null,
      },
    },
    { status: problems.length === 0 ? 200 : 503 },
  );
}
