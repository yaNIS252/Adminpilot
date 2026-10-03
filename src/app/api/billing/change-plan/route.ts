import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { getStripe, planFromPriceId, priceIdFor } from "@/lib/billing/stripe";
import { applySubscription } from "@/lib/billing/sync";
import { PLAN_PRICES } from "@/lib/constants";
import { readJson } from "@/lib/http/request";

export const runtime = "nodejs";

/**
 * Changement de formule d'un abonné : Pro ↔ Premium, mensuel ↔ annuel.
 *
 * Fait ici plutôt que dans le portail Stripe : le portail ne propose le
 * changement que si on l'a configuré produit par produit, et il ne sait rien
 * du foyer. Ici, on sait prévenir avant qu'un passage au Pro retire l'accès
 * aux membres invités.
 *
 * Proratisation : une montée en gamme est facturée tout de suite, au prorata
 * des jours restants — l'utilisateur obtient aussitôt ce qu'il paie. Une
 * descente crédite la différence sur la prochaine facture, sans rembourser.
 */

const BodySchema = z.object({
  plan: z.enum(["pro", "family"]),
  cycle: z.enum(["monthly", "yearly"]),
});

function yearlyCost(plan: "pro" | "family", cycle: "monthly" | "yearly") {
  const price = PLAN_PRICES[plan][cycle];
  return cycle === "monthly" ? price * 12 : price;
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const subscriptionId = auth.profile.stripe_sub_id;
  if (!subscriptionId || auth.profile.plan === "free") {
    return NextResponse.json({ error: "aucun abonnement" }, { status: 409 });
  }

  const body = await readJson(request, BodySchema);
  if (!body.ok) return body.response;
  const { plan, cycle } = body.data;

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (subscription.status !== "active" && subscription.status !== "trialing") {
      return NextResponse.json({ error: "abonnement inactif" }, { status: 409 });
    }

    const item = subscription.items.data[0];
    const currentPlan = planFromPriceId(item.price.id);
    const currentCycle =
      item.price.recurring?.interval === "year" ? "yearly" : "monthly";

    const targetPrice = priceIdFor(plan, cycle);
    if (item.price.id === targetPrice) {
      return NextResponse.json({ error: "déjà sur cette formule" }, { status: 409 });
    }

    const upgrade =
      !currentPlan ||
      currentPlan === "free" ||
      yearlyCost(plan, cycle) > yearlyCost(currentPlan, currentCycle);

    const updated = await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: item.id, price: targetPrice }],
      proration_behavior: upgrade ? "always_invoice" : "create_prorations",
      // Une montée dont le paiement échoue ne doit pas être accordée :
      // Stripe annule alors la modification au lieu de la laisser impayée.
      payment_behavior: upgrade ? "error_if_incomplete" : "allow_incomplete",
      cancel_at_period_end: false,
    });

    // Le webhook suivra, mais l'utilisateur doit voir sa nouvelle formule dès
    // le rechargement de la page, pas après un délai de livraison.
    const applied = await applySubscription(updated);

    return NextResponse.json({ plan: applied, upgrade });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeCardError) {
      return NextResponse.json(
        { error: "paiement refusé", code: "card_declined" },
        { status: 402 },
      );
    }
    if (error instanceof Stripe.errors.StripeError) {
      console.error("[billing/change-plan]", error.type, error.code, error.message);
      return NextResponse.json(
        { error: "changement impossible", code: error.code ?? error.type },
        { status: 502 },
      );
    }
    throw error;
  }
}
