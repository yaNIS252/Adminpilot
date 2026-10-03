import "server-only";

import type Stripe from "stripe";

import { REVIEW_THRESHOLD } from "@/lib/ai/schemas";
import { scheduleDeadlineAlerts } from "@/lib/alerts/schedule";
import { getStripe, planFromPriceId } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Applique l'état d'un abonnement Stripe au profil de son titulaire, puis à
 * son foyer.
 *
 * `fresh` force une relecture chez Stripe au lieu de croire l'objet reçu.
 * Stripe ne garantit pas l'ordre de livraison des webhooks : un
 * `subscription.updated` retardé, arrivant après un `subscription.deleted`,
 * rouvrait un accès payant sur un abonnement résilié. Relire l'objet donne
 * toujours son état courant, quel que soit l'ordre d'arrivée.
 */
export async function applySubscription(
  input: Stripe.Subscription,
  { fresh = true }: { fresh?: boolean } = {},
) {
  const subscription = fresh
    ? await getStripe().subscriptions.retrieve(input.id)
    : input;

  const db = createAdminClient();
  const userId = subscription.metadata?.user_id;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceId ? planFromPriceId(priceId) : null;

  // Un abonnement actif ou en période d'essai ouvre les droits. Tout autre
  // état (impayé, annulé, incomplet) ramène au plan gratuit : on ne laisse
  // pas un accès payant ouvert sur un paiement qui n'a pas abouti.
  const entitled =
    subscription.status === "active" || subscription.status === "trialing";

  const paidPlan: Enums<"plan"> = entitled && plan ? plan : "free";

  const update = {
    plan: paidPlan,
    stripe_customer_id: customerId,
    stripe_sub_id: subscription.id,
    updated_at: new Date().toISOString(),
  };

  // On privilégie l'identifiant porté par les métadonnées ; sinon on retombe
  // sur le client Stripe, qui reste stable dans le temps.
  const query = userId
    ? db.from("profiles").update(update).eq("id", userId)
    : db.from("profiles").update(update).eq("stripe_customer_id", customerId);

  const { data: profiles, error } = await query.select("id");
  if (error) throw error;

  // Fin d'un abonnement personnel chez quelqu'un qui appartient aussi à un
  // foyer Premium : il retombe sur la formule du foyer, pas sur le gratuit.
  if (update.plan === "free") {
    for (const profile of profiles ?? []) {
      if (await coveredByHousehold(db, profile.id)) {
        await db
          .from("profiles")
          .update({ plan: "family" })
          .eq("id", profile.id);
      }
    }
  }

  for (const profile of profiles ?? []) {
    if (update.plan !== "free") {
      await unlockHiddenSubscriptions(db, profile.id);
    }
    await syncHousehold(db, profile.id, update.plan);
    await syncOwnSubscription(db, profile.id, subscription, entitled && Boolean(plan));
  }

  return update.plan;
}

/** Marqueur de l'abonnement AdminPilot dans la liste des abonnements suivis. */
export const OWN_SUBSCRIPTION_SOURCE = "adminpilot_billing";

/**
 * L'abonnement AdminPilot lui-même apparaît parmi les abonnements suivis de
 * l'utilisateur : montant, périodicité, prochaine échéance et rappels, comme
 * n'importe quel autre. Un outil qui suit les abonnements et cache le sien
 * serait mal placé pour inspirer confiance.
 *
 * Tenu à jour uniquement depuis Stripe : l'utilisateur ne le saisit pas, et sa
 * résiliation passe par les réglages, pas par une lettre.
 */
async function syncOwnSubscription(
  db: Db,
  userId: string,
  subscription: Stripe.Subscription,
  active: boolean,
) {
  const item = subscription.items.data[0];
  const price = item?.price;
  const plan = price ? planFromPriceId(price.id) : null;
  const amount = price?.unit_amount != null ? price.unit_amount / 100 : null;
  const cycle = price?.recurring?.interval === "year" ? "yearly" : "monthly";
  // Pas de prochaine échéance si la résiliation est programmée : il n'y aura
  // pas de renouvellement à rappeler.
  const periodEnd = item?.current_period_end ?? null;
  const nextRenewal =
    active && periodEnd && !subscription.cancel_at_period_end && !subscription.cancel_at
      ? new Date(periodEnd * 1000).toISOString().slice(0, 10)
      : null;
  const provider = `AdminPilot ${plan === "family" ? "Premium" : "Pro"}`;

  const { data: existing } = await db
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("metadata->>source", OWN_SUBSCRIPTION_SOURCE)
    .maybeSingle();

  const row = {
    provider,
    amount,
    currency: (price?.currency ?? "eur").toUpperCase(),
    cycle: cycle as "monthly" | "yearly",
    category: "logiciel",
    next_renewal: nextRenewal,
    status: active ? ("active" as const) : ("cancelled" as const),
    cancelled_at: active ? null : new Date().toISOString(),
    confidence: 1,
    confirmed_by_user: true,
    over_quota: false,
    metadata: { source: OWN_SUBSCRIPTION_SOURCE, stripe_subscription: subscription.id },
  };

  let id = existing?.id ?? null;
  if (id) {
    await db.from("subscriptions").update(row).eq("id", id);
  } else if (active) {
    const { data } = await db
      .from("subscriptions")
      .insert({ ...row, user_id: userId })
      .select("id")
      .single();
    id = data?.id ?? null;
  }
  if (!id) return;

  // Rappels d'échéance : recalés sur la date Stripe à chaque changement.
  await db
    .from("alerts")
    .delete()
    .eq("user_id", userId)
    .eq("ref_id", id)
    .eq("kind", "deadline")
    .is("sent_at", null);
  if (nextRenewal) {
    await scheduleDeadlineAlerts({
      userId,
      refType: "subscription",
      refId: id,
      deadline: nextRenewal,
      title: `${provider} se renouvelle`,
      message: `Prochain prélèvement le ${nextRenewal}.`,
    });
  }
}

/**
 * Répercute la formule du titulaire sur les membres de son foyer.
 *
 * Premium couvre le foyer ; dès que le titulaire en sort (retour au Pro,
 * résiliation, impayé), ses membres repassent en gratuit. Un membre qui paie
 * lui-même un Pro n'est jamais touché : seules les transitions gratuit ↔
 * Premium sont appliquées, on ne lui retire pas ce qu'il a acheté.
 */
export async function syncHousehold(
  db: Db,
  ownerId: string,
  ownerPlan: Enums<"plan">,
) {
  const { data: links, error } = await db
    .from("family_members")
    .select("member_id")
    .eq("owner_id", ownerId)
    .not("member_id", "is", null);

  if (error) throw error;
  const memberIds = (links ?? [])
    .map((link) => link.member_id)
    .filter((id): id is string => Boolean(id));
  if (memberIds.length === 0) return;

  const covered = ownerPlan === "family";

  const { error: updateError } = await db
    .from("profiles")
    .update({
      plan: covered ? "family" : "free",
      updated_at: new Date().toISOString(),
    })
    .in("id", memberIds)
    .eq("plan", covered ? "free" : "family");
  if (updateError) throw updateError;

  if (covered) {
    for (const memberId of memberIds) {
      await unlockHiddenSubscriptions(db, memberId);
    }
  }
}

/** Vrai si l'utilisateur est membre d'un foyer dont le titulaire est Premium. */
export async function coveredByHousehold(db: Db, userId: string) {
  const { data } = await db
    .from("family_members")
    .select("owner:profiles!family_members_owner_id_fkey(plan)")
    .eq("member_id", userId)
    .maybeSingle();

  return data?.owner?.plan === "family";
}

/**
 * Révèle les abonnements détectés au-delà du quota gratuit.
 *
 * C'est la promesse faite par l'encart « N autres abonnements détectés » :
 * payer les fait apparaître tout de suite, sans retransférer un seul e-mail.
 * Leurs alertes n'avaient pas été programmées tant qu'ils étaient masqués ;
 * elles le sont ici, avec les mêmes règles que dans le pipeline — une
 * extraction peu sûre ne déclenche pas d'alerte.
 */
export async function unlockHiddenSubscriptions(db: Db, userId: string) {
  const { data: unlocked, error } = await db
    .from("subscriptions")
    .update({ over_quota: false })
    .eq("user_id", userId)
    .eq("over_quota", true)
    .select("id, provider, next_renewal, confidence");

  if (error) throw error;

  for (const sub of unlocked ?? []) {
    if (!sub.next_renewal || sub.confidence < REVIEW_THRESHOLD) continue;
    await scheduleDeadlineAlerts({
      userId,
      refType: "subscription",
      refId: sub.id,
      deadline: sub.next_renewal,
      title: `${sub.provider} se renouvelle`,
      message: `Prochaine échéance le ${sub.next_renewal}.`,
    });
  }
}
