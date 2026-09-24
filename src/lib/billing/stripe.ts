import "server-only";

import Stripe from "stripe";

import type { Enums } from "@/lib/supabase/types";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquante");
  cached ??= new Stripe(key);
  return cached;
}

/**
 * Correspondance prix Stripe → plan interne.
 *
 * Volontairement pilotée par des identifiants de prix et non par des montants :
 * un changement de tarif ne doit jamais casser l'attribution du plan d'un
 * client déjà abonné, qui conserve son ancien prix.
 */
export function planFromPriceId(priceId: string): Enums<"plan"> | null {
  const map: Record<string, Enums<"plan">> = {
    [process.env.STRIPE_PRICE_PRO_MONTHLY ?? ""]: "pro",
    [process.env.STRIPE_PRICE_PRO_YEARLY ?? ""]: "pro",
    [process.env.STRIPE_PRICE_FAMILY_MONTHLY ?? ""]: "family",
    [process.env.STRIPE_PRICE_FAMILY_YEARLY ?? ""]: "family",
  };
  return map[priceId] ?? null;
}

export function priceIdFor(
  plan: "pro" | "family",
  cycle: "monthly" | "yearly",
): string {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`;
  const priceId = process.env[key];
  if (!priceId) throw new Error(`${key} manquante`);
  return priceId;
}

export async function createCheckoutSession(input: {
  userId: string;
  email: string;
  stripeCustomerId: string | null;
  plan: "pro" | "family";
  cycle: "monthly" | "yearly";
  siteUrl: string;
}): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceIdFor(input.plan, input.cycle), quantity: 1 }],
    ...(input.stripeCustomerId
      ? { customer: input.stripeCustomerId }
      : { customer_email: input.email }),
    // Seule source fiable pour relier la session à un compte au retour du
    // webhook : l'email peut différer de celui du compte.
    client_reference_id: input.userId,
    subscription_data: { metadata: { user_id: input.userId } },
    success_url: `${input.siteUrl}/dashboard?abonnement=actif`,
    cancel_url: `${input.siteUrl}/pricing`,
    allow_promotion_codes: true,
    locale: "fr",
  });

  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement");
  return session.url;
}

export async function createPortalSession(input: {
  stripeCustomerId: string;
  siteUrl: string;
}): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({
    customer: input.stripeCustomerId,
    return_url: `${input.siteUrl}/reglages`,
  });
  return session.url;
}
