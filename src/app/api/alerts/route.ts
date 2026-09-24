import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { checkLimit, incrementUsage } from "@/lib/billing/quotas";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Gestion des alertes.
 *
 * Les alertes automatiques (J-7, J-1) sont créées par le pipeline. Celles-ci
 * sont les alertes manuelles, et la possibilité pour l'utilisateur de désactiver
 * ce qui le dérange — un produit qui notifie trop est désinstallé.
 */

const PostSchema = z.object({
  ref_type: z.enum(["subscription", "document"]),
  ref_id: z.string().uuid(),
  title: z.string().min(1).max(160),
  message: z.string().max(500).default(""),
  alert_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  channel: z.enum(["email", "push", "both"]).default("email"),
});

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const scope = new URL(request.url).searchParams.get("scope") ?? "upcoming";
  const supabase = await createClient();

  let query = supabase
    .from("alerts")
    .select("*")
    .order("alert_date", { ascending: scope === "upcoming" })
    .limit(100);

  if (scope === "upcoming") query = query.is("sent_at", null);
  else if (scope === "sent") query = query.not("sent_at", "is", null);

  const { data, error } = await query;
  if (error) throw error;

  return NextResponse.json({ alerts: data });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const quota = await checkLimit(auth.userId, auth.profile.plan, "alerts");
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "quota atteint", feature: "alerts", ...quota },
      { status: 402 },
    );
  }

  const parsed = PostSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "requête invalide", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alerts")
    .insert({
      ...parsed.data,
      user_id: auth.userId,
      // Suffixe aléatoire : une alerte manuelle peut légitimement doublonner
      // une alerte automatique sur la même échéance.
      dedup_key: `manuel:${auth.userId}:${parsed.data.ref_id}:${crypto.randomUUID()}`,
    })
    .select("*")
    .single();

  if (error) throw error;
  await incrementUsage(auth.userId, "alerts");

  return NextResponse.json({ alert: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id manquant" }, { status: 400 });
  }

  const supabase = await createClient();
  // Seules les alertes non envoyées sont supprimables : l'historique de ce qui
  // a réellement été notifié ne doit pas pouvoir être réécrit.
  const { error } = await supabase
    .from("alerts")
    .delete()
    .eq("id", id)
    .is("sent_at", null);

  if (error) throw error;
  return NextResponse.json({ deleted: true });
}
