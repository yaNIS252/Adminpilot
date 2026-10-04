import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import {
  createCheckoutSession,
  createPortalSession,
  ensureCustomer,
} from "@/lib/billing/stripe";
import { readJson } from "@/lib/http/request";
import { bonusActive } from "@/lib/referral/bonus";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Ouvre une session de paiement, ou le portail client si l'utilisateur est
 * déjà abonné — c'est là qu'il change de formule ou résilie, géré par Stripe.
 */

const BodySchema = z.object({
  plan: z.enum(["pro", "family"]),
  cycle: z.enum(["monthly", "yearly"]).default("monthly"),
  /**
   * Demande expresse de commencer avant la fin du délai de rétractation
   * (art. L221-25 du Code de la consommation). Sans elle, le service ne
   * peut pas démarrer avant 14 jours sans exposer à un remboursement intégral.
   */
  immediateStart: z.literal(true),
});

export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (error) {
    // Une erreur Stripe remontait en 500 au corps vide : impossible pour
    // l'interface de dire quoi que ce soit, et pour nous de diagnostiquer.
    if (error instanceof Stripe.errors.StripeError) {
      console.error(
        "[billing/checkout]",
        error.type,
        error.code,
        error.param,
        error.message,
      );

      // Cas typique d'une mise en place : clé du mode réel, prix créés en mode
      // test (ou l'inverse). Stripe le signale dans son message ; on en fait un
      // code explicite plutôt que de renvoyer le message brut au navigateur.
      const modeMismatch = /similar object exists in (test|live) mode/i.test(
        error.message,
      );

      return NextResponse.json(
        {
          error: "paiement indisponible",
          code: modeMismatch ? "stripe_mode_mismatch" : (error.code ?? error.type),
          param: error.param ?? null,
          // Description du refus par Stripe. Pour une requête invalide, elle
          // décrit un réglage manquant ou un paramètre, jamais un secret, et
          // c'est souvent la seule piste quand ni code ni paramètre ne sont
          // renseignés (compte incomplet, par exemple).
          detail:
            error instanceof Stripe.errors.StripeInvalidRequestError
              ? error.message
              : null,
        },
        { status: 502 },
      );
    }
    throw error;
  }
}

async function handle(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  // Membre d'un foyer : Premium lui vient du titulaire, il n'a ni abonnement
  // ni portail. Lui ouvrir un paiement le ferait payer une seconde fois.
  // Un mois offert par parrainage n'est pas un abonnement : il peut, lui,
  // être prolongé par un paiement.
  const onBonus = bonusActive(auth.profile);

  if (auth.profile.plan !== "free" && !auth.profile.stripe_sub_id && !onBonus) {
    return NextResponse.json(
      { error: "formule incluse dans un foyer", code: "household_member" },
      { status: 409 },
    );
  }

  // Stripe absent de la configuration : un message exploitable plutôt qu'une
  // exception brute, pour que l'interface puisse dire la vérité à
  // l'utilisateur au lieu d'un « erreur 500 » incompréhensible.
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "paiement indisponible", code: "billing_not_configured" },
      { status: 503 },
    );
  }

  const base = siteUrl();

  // Déjà client et déjà sur un plan payant : le portail Stripe est le bon
  // endroit, une seconde session de paiement créerait un doublon d'abonnement.
  if (auth.profile.stripe_customer_id && auth.profile.plan !== "free" && !onBonus) {
    const url = await createPortalSession({
      stripeCustomerId: auth.profile.stripe_customer_id,
      siteUrl: base,
    });
    return NextResponse.json({ url, kind: "portal" });
  }

  const body = await readJson(request, BodySchema);
  if (!body.ok) return body.response;

  const customerId = await ensureCustomer({
    userId: auth.userId,
    email: auth.profile.email,
    stripeCustomerId: auth.profile.stripe_customer_id,
  });

  // Mémorisé tout de suite, avant même le paiement : une seconde tentative
  // réutilisera ce client au lieu d'en créer un autre. Client de service, car
  // l'utilisateur ne doit pas pouvoir écrire lui-même cette colonne.
  if (customerId !== auth.profile.stripe_customer_id) {
    await createAdminClient()
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", auth.userId);
  }

  const url = await createCheckoutSession({
    userId: auth.userId,
    stripeCustomerId: customerId,
    plan: body.data.plan,
    cycle: body.data.cycle,
    siteUrl: base,
    trialEnd: onBonus && auth.profile.bonus_pro_until ? new Date(auth.profile.bonus_pro_until) : null,
  });

  return NextResponse.json({ url, kind: "checkout" });
}
