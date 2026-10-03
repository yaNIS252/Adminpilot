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

/**
 * Mention obligatoire sur chaque facture tant que l'activité relève de la
 * franchise en base de TVA (article 293 B du CGI, seuil de 37 500 € de
 * chiffre d'affaires annuel pour les prestations de services). Son absence
 * est une irrégularité de facturation. À retirer le jour où la franchise
 * cesse — les prix affichés deviennent alors TTC avec 20 % de TVA.
 */
const VAT_FOOTER = "TVA non applicable, art. 293 B du CGI.";

/**
 * Client Stripe du compte, créé s'il n'existe pas encore.
 *
 * Créé AVANT la session de paiement et non par Checkout : c'est le seul moyen
 * de poser la mention de TVA sur toutes ses factures futures, et de pouvoir
 * mémoriser son identifiant tout de suite. Laisser Checkout le créer
 * produisait un nouveau client à chaque tentative abandonnée.
 */
export async function ensureCustomer(input: {
  userId: string;
  email: string;
  stripeCustomerId: string | null;
}): Promise<string> {
  const stripe = getStripe();

  if (input.stripeCustomerId) {
    await stripe.customers.update(input.stripeCustomerId, {
      invoice_settings: { footer: VAT_FOOTER },
    });
    return input.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: input.email,
    metadata: { user_id: input.userId },
    invoice_settings: { footer: VAT_FOOTER },
    preferred_locales: ["fr"],
  });
  return customer.id;
}

export async function createCheckoutSession(input: {
  userId: string;
  stripeCustomerId: string;
  plan: "pro" | "family";
  cycle: "monthly" | "yearly";
  siteUrl: string;
}): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceIdFor(input.plan, input.cycle), quantity: 1 }],
    customer: input.stripeCustomerId,
    // Seule source fiable pour relier la session à un compte au retour du
    // webhook : l'email peut différer de celui du compte.
    client_reference_id: input.userId,
    subscription_data: {
      metadata: {
        user_id: input.userId,
        // Preuve horodatée de la demande d'exécution immédiate, exigée pour
        // facturer au prorata en cas de rétractation dans les 14 jours.
        immediate_start_requested_at: new Date().toISOString(),
      },
    },
    success_url: `${input.siteUrl}/dashboard?abonnement=actif`,
    // Retour là où le bouton a été cliqué, avec le choix intact : une
    // hésitation au moment de payer ne doit pas obliger à tout recommencer.
    cancel_url: `${input.siteUrl}/reglages?formule=${input.plan}&cycle=${input.cycle}&paiement=annule#formules`,
    allow_promotion_codes: true,
    // Un code promo à 100 % (Premium offert à un proche) ramène le total à
    // 0 € : Stripe ne demande alors aucune carte. Sans ce réglage, il en
    // exigeait une même pour un abonnement gratuit.
    payment_method_collection: "if_required",
    locale: "fr",
    // « Managed Payments » est activé par défaut sur les comptes Stripe
    // récents : Stripe y devient le vendeur officiel et collecte la TVA. Ce
    // n'est pas le modèle d'AdminPilot — vendeur en nom propre, en franchise
    // de TVA (art. 293 B du CGI), comme l'annoncent les CGU. Le laisser actif
    // bloquait d'ailleurs tout paiement, faute de code fiscal sur les produits.
    managed_payments: { enabled: false },
  });

  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement");
  return session.url;
}

export async function createPortalSession(input: {
  stripeCustomerId: string;
  siteUrl: string;
  /** Ouvre directement l'écran de résiliation de cet abonnement. */
  cancelSubscriptionId?: string;
}): Promise<string> {
  const returnUrl = `${input.siteUrl}/reglages`;
  const session = await getStripe().billingPortal.sessions.create({
    customer: input.stripeCustomerId,
    return_url: returnUrl,
    ...(input.cancelSubscriptionId
      ? {
          flow_data: {
            type: "subscription_cancel" as const,
            subscription_cancel: { subscription: input.cancelSubscriptionId },
            after_completion: {
              type: "redirect" as const,
              redirect: { return_url: `${returnUrl}?resiliation=enregistree` },
            },
          },
        }
      : {}),
  });
  return session.url;
}
