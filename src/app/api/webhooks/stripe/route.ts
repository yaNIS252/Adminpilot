import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/billing/stripe";
import { applySubscription } from "@/lib/billing/sync";

export const runtime = "nodejs";

/**
 * Webhook Stripe — source de vérité de l'état d'abonnement.
 *
 * Le retour de Checkout dans le navigateur ne prouve rien : l'utilisateur peut
 * fermer l'onglet, et l'URL de succès est forgeable. Seul ce webhook, signé,
 * fait foi pour accorder ou retirer un plan.
 */

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
