import { NextResponse } from "next/server";
import Stripe from "stripe";

import { requireUser } from "@/lib/auth/require-user";
import { createPortalSession } from "@/lib/billing/stripe";
import { siteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

/**
 * « Résilier mon abonnement » : ouvre directement l'écran de résiliation du
 * portail Stripe, en un clic depuis les réglages.
 *
 * Obligation légale depuis juin 2023 pour tout abonnement souscrit en ligne :
 * une fonction de résiliation gratuite, clairement intitulée et accessible
 * sans détour (art. L215-1-1 du Code de la consommation). La confirmation
 * écrite part à la réception du webhook Stripe.
 */
export async function POST() {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const { stripe_customer_id: customerId, stripe_sub_id: subscriptionId } = auth.profile;
  if (!customerId || !subscriptionId || auth.profile.plan === "free") {
    return NextResponse.json({ error: "aucun abonnement à résilier" }, { status: 409 });
  }

  try {
    const url = await createPortalSession({
      stripeCustomerId: customerId,
      siteUrl: siteUrl(),
      cancelSubscriptionId: subscriptionId,
    });
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error("[billing/cancel]", error.type, error.code, error.message);
      return NextResponse.json(
        { error: "résiliation indisponible", code: error.code ?? error.type },
        { status: 502 },
      );
    }
    throw error;
  }
}
