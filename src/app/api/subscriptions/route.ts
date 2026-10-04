import { NextResponse } from "next/server";
import { z } from "zod";

import { BILLING_CYCLES, SUB_CATEGORIES } from "@/lib/ai/schemas";
import { requireUser } from "@/lib/auth/require-user";
import { scheduleDeadlineAlerts } from "@/lib/alerts/schedule";
import { invalidId, readJson, readUuid } from "@/lib/http/request";
import { matchCatalogue } from "@/lib/cancel/links";
import {
  exceedsSubscriptionQuota,
  findExistingSubscription,
  markCancelled,
} from "@/lib/ingest/pipeline";
import { isAdminPilotProvider } from "@/lib/ingest/sender-learning";
import { createAdminClient } from "@/lib/supabase/admin";
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
  /** Coupe ou rallume les rappels d'échéance de cet abonnement. */
  reminders_muted: z.boolean().optional(),
});

const CreateSchema = z.object({
  provider: z.string().trim().min(1).max(120),
  amount: z.number().nonnegative().max(100_000).nullable(),
  cycle: z.enum(BILLING_CYCLES).default("monthly"),
  category: z.enum(SUB_CATEGORIES).default("autre"),
  next_renewal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
});

/**
 * Ajout manuel d'un abonnement que l'analyse n'a pas trouvé (aucun e-mail,
 * prélèvement bancaire sans facture, abonnement payé en espèces…).
 *
 * Mêmes règles qu'une détection : limite de la formule, pas de doublon d'un
 * abonnement déjà suivi, rappels d'échéance. Saisi par l'utilisateur, il est
 * confirmé d'office.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const body = await readJson(request, CreateSchema);
  if (!body.ok) return body.response;
  const input = body.data;
  const db = createAdminClient();

  if (isAdminPilotProvider(input.provider)) {
    return NextResponse.json(
      { error: "l'abonnement AdminPilot est suivi automatiquement", code: "own_subscription" },
      { status: 409 },
    );
  }

  const existing = await findExistingSubscription(db, auth.userId, input.provider);
  if (existing) {
    return NextResponse.json(
      { error: "déjà suivi", code: "duplicate", id: existing.id },
      { status: 409 },
    );
  }

  // Un ajout manuel ne se met pas en réserve comme une détection : on
  // prévient plutôt que d'enregistrer un abonnement que l'utilisateur ne
  // verrait pas.
  if (await exceedsSubscriptionQuota(db, auth.userId)) {
    return NextResponse.json({ error: "limite atteinte", code: "limit" }, { status: 403 });
  }

  const catalogue = await matchCatalogue(db, { provider: input.provider });

  const { data, error } = await db
    .from("subscriptions")
    .insert({
      user_id: auth.userId,
      provider: input.provider,
      amount: input.amount,
      cycle: input.cycle,
      category: input.category,
      next_renewal: input.next_renewal,
      status: "active",
      confidence: 1,
      confirmed_by_user: true,
      provider_id: catalogue?.id ?? null,
      metadata: { source: "manual" },
    })
    .select("*")
    .single();
  if (error) throw error;

  if (data.next_renewal) {
    await scheduleDeadlineAlerts({
      userId: auth.userId,
      refType: "subscription",
      refId: data.id,
      deadline: data.next_renewal,
      title: `${data.provider} se renouvelle`,
      message: `Prochaine échéance le ${data.next_renewal}.`,
    });
  }

  return NextResponse.json({ subscription: data }, { status: 201 });
}

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
    .eq("over_quota", false)
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
  // Couper les rappels n'est pas une correction des données extraites.
  const touchesData = Object.keys(changes).some(
    (key) => key !== "confirmed_by_user" && key !== "reminders_muted",
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

  // Résiliation déclarée à la main, ou reprise du suivi d'un abonnement
  // résilié. `cancelled_at` n'est pas modifiable depuis le navigateur
  // (migration 0010) : il est tenu ici, avec la clé de service.
  if (changes.status === "cancelled") {
    await markCancelled(createAdminClient(), auth.userId, id, {
      effectiveDate: null,
      via: "user",
    });
  } else if (changes.status === "active") {
    await createAdminClient()
      .from("subscriptions")
      .update({ cancelled_at: null })
      .eq("id", id)
      .eq("user_id", auth.userId);
    if (data.next_renewal && !data.reminders_muted) {
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

  // Une date corrigée invalide les alertes programmées sur l'ancienne : la
  // dedup_key les sépare, mais celles de l'ancienne date doivent disparaître.
  if (changes.next_renewal !== undefined || changes.reminders_muted !== undefined) {
    // Seuls les rappels d'échéance automatiques : un rappel créé à la main
    // ou une alerte de hausse de prix ne dépendent pas de cette date.
    await supabase
      .from("alerts")
      .delete()
      .eq("ref_type", "subscription")
      .eq("ref_id", id)
      .eq("kind", "deadline")
      .is("sent_at", null);

    if (data.next_renewal && data.status === "active" && !data.reminders_muted) {
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
