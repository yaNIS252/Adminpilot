import { NextResponse } from "next/server";

import { inboxAddress, requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Export des données personnelles — droit à la portabilité (RGPD, art. 20).
 *
 * Format JSON structuré et lisible par une machine, comme l'exige le texte :
 * un PDF ou une capture d'écran ne satisferaient pas l'obligation.
 *
 * Les documents eux-mêmes ne sont pas inclus dans la charge utile : l'export
 * pèserait des centaines de mégaoctets. Chaque entrée porte son URL signée,
 * valable vingt-quatre heures, pour être téléchargée séparément.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const supabase = await createClient();

  const [subscriptions, documents, alerts, cancellations, usage] =
    await Promise.all([
      supabase.from("subscriptions").select("*"),
      supabase.from("documents").select("*"),
      supabase.from("alerts").select("*"),
      supabase.from("cancellations").select("*"),
      supabase.from("usage_counters").select("*"),
    ]);

  const payload = {
    exported_at: new Date().toISOString(),
    profile: {
      email: auth.profile.email,
      name: auth.profile.name,
      plan: auth.profile.plan,
      inbox_address: inboxAddress(auth.profile),
      created_at: auth.profile.created_at,
    },
    subscriptions: subscriptions.data ?? [],
    documents: documents.data ?? [],
    alerts: alerts.data ?? [],
    cancellations: cancellations.data ?? [],
    usage_counters: usage.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="adminpilot-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
