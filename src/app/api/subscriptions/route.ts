import { NextResponse } from "next/server";
import { z } from "zod";

import { BILLING_CYCLES, SUB_CATEGORIES } from "@/lib/ai/schemas";
import { requireUser } from "@/lib/auth/require-user";
import { scheduleDeadlineAlerts } from "@/lib/alerts/schedule";
import { invalidId, readJson, readUuid } from "@/lib/http/request";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Lecture et correction des abonnements détectés.
 *
 * C'est la route qui rend la file de revue utile : sans elle, l'utilisateur
 * voit les extractions douteuses sans pouvoir les corriger, et une donnée
 * fausse reste fausse pour toujours.
 *
 * Toutes les requêtes passent par le client de session, donc sous RLS : un
 * identifiant d'abonnement appartenant à quelqu'un d'autre ne renvoie rien.
 */

const PatchSchema = z.object({
  id: z.string().uuid(),
  provider: z.string().min(1).max(120).optional(),
  amount: z.number().nonnegative().nullable().optional(),
  cycle: z.enum(BILLING_CYCLES).optional(),
  category: z.enum(SUB_CATEGORIES).optional(),
  next_renewal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  status: z.enum(["active", "cancelled", "paused", "expired"]).optional(),
  /** Validation explicite de l'utilisateur sur une extraction automatique. */
  confirmed_by_user: z.boolean().optional(),
});

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const url = new URL(request.url);
  const needsReview = url.searchParams.get("review") === "1";

  const supabase = await createClient();
  let query = supabase
    .from("subscriptions")
    .select("*, known_providers(name, seo_slug, cancel_method, legal_basis)")
    .order("amount", { ascending: false, nullsFirst: false });

  if (needsReview) {
    query = query.eq("confirmed_by_user", false).lt("confidence", 0.7);
  } else {
    query = query.eq("status", "active");
  }

  const { data, error } = await query;
  if (error) throw error;

  return NextResponse.json({ subscriptions: data });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const body = await readJson(request, PatchSchema);
  if (!body.ok) return body.response;

  const { id, ...changes } = body.data;
  const supabase = await createClient();

  // Une correction manuelle vaut confirmation : si l'utilisateur prend la
  // peine de rectifier une valeur, la ligne n'est plus une simple supposition.
  const touchesData = Object.keys(changes).some(
    (key) => key !== "confirmed_by_user",
  );
  const patch = touchesData
    ? { ...changes, confidence: 1, confirmed_by_user: true }
    : changes;

  const { data, error } = await supabase
    .from("subscriptions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  // Une date corrigée invalide les alertes programmées sur l'ancienne : la
  // dedup_key les sépare, mais celles de l'ancienne date doivent disparaître.
  if (changes.next_renewal !== undefined) {
    await supabase
      .from("alerts")
      .delete()
      .eq("ref_type", "subscription")
      .eq("ref_id", id)
      .is("sent_at", null);

    if (data.next_renewal && data.status === "active") {
      await scheduleDeadlineAlerts({
        userId: auth.userId,
        refType: "subscription",
        refId: id,
        deadline: data.next_renewal,
        title: `${data.provider} se renouvelle`,
        message: `Prochaine échéance le ${data.next_renewal}.`,
      });
    }
  }

  return NextResponse.json({ subscription: data });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const id = readUuid(new URL(request.url).searchParams.get("id"));
  if (!id) return invalidId();

  const supabase = await createClient();
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
  if (error) throw error;

  // Les alertes non envoyées n'ont plus d'objet. Celles déjà parties restent :
  // elles font partie de l'historique.
  await supabase
    .from("alerts")
    .delete()
    .eq("ref_type", "subscription")
    .eq("ref_id", id)
    .is("sent_at", null);

  return NextResponse.json({ deleted: true });
}
