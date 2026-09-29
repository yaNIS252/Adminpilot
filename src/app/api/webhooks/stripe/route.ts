import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { REVIEW_THRESHOLD } from "@/lib/ai/schemas";
import { scheduleDeadlineAlerts } from "@/lib/alerts/schedule";
import { getStripe, planFromPriceId } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Webhook Stripe — source de vérité de l'état d'abonnement.
 *
 * Le retour de Checkout dans le navigateur ne prouve rien : l'utilisateur peut
 * fermer l'onglet, et l'URL de succès est forgeable. Seul ce webhook, signé,
 * fait foi pour accorder ou retirer un plan.
 */

/**
 * Applique l'état d'un abonnement au profil.
 *
 * `fresh` force une relecture chez Stripe au lieu de croire la charge utile de
 * l'événement. Stripe ne garantit pas l'ordre de livraison : un
 * `subscription.updated` retardé, arrivant après un `subscription.deleted`,
 * rouvrait un accès payant sur un abonnement résilié. Relire l'objet donne
 * toujours son état courant, quel que soit l'ordre d'arrivée.
 */
async function applySubscription(
  event: Stripe.Subscription,
  { fresh = true }: { fresh?: boolean } = {},
) {
  const subscription = fresh
    ? await getStripe().subscriptions.retrieve(event.id)
    : event;

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

  const update = {
    plan: entitled && plan ? plan : ("free" as const),
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

  if (update.plan !== "free") {
    for (const profile of profiles ?? []) {
      await unlockHiddenSubscriptions(db, profile.id);
    }
  }
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
async function unlockHiddenSubscriptions(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
) {
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

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "signature absente" }, { status: 400 });
  }

  // Le corps brut est indispensable : toute réécriture, même un JSON.parse
  // suivi d'un re-stringify, invalide la signature.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "signature invalide" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.subscription) {
        const subscription = await getStripe().subscriptions.retrieve(
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id,
        );
        // Checkout ne propage pas toujours `client_reference_id` jusqu'à
        // l'abonnement : on le recopie pour les événements suivants.
        if (session.client_reference_id && !subscription.metadata?.user_id) {
          subscription.metadata = {
            ...subscription.metadata,
            user_id: session.client_reference_id,
          };
          await getStripe().subscriptions.update(subscription.id, {
            metadata: subscription.metadata,
          });
        }
        // Déjà relu à l'instant depuis Stripe : une seconde lecture n'apporte
        // rien et consomme un appel d'API.
        await applySubscription(subscription, { fresh: false });
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applySubscription(event.data.object);
      break;

    default:
      // Les autres événements sont acquittés sans traitement : renvoyer une
      // erreur ferait réessayer Stripe indéfiniment pour rien.
      break;
  }

  return NextResponse.json({ received: true });
}
