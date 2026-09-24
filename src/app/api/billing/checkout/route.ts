import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/stripe";

export const runtime = "nodejs";

/**
 * Ouvre une session de paiement, ou le portail client si l'utilisateur est
 * déjà abonné — c'est là qu'il change de formule ou résilie, géré par Stripe.
 */

const BodySchema = z.object({
  plan: z.enum(["pro", "family"]),
  cycle: z.enum(["monthly", "yearly"]).default("monthly"),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adminpilot.zylax.fr";

  // Déjà client et déjà sur un plan payant : le portail Stripe est le bon
  // endroit, une seconde session de paiement créerait un doublon d'abonnement.
  if (auth.profile.stripe_customer_id && auth.profile.plan !== "free") {
    const url = await createPortalSession({
      stripeCustomerId: auth.profile.stripe_customer_id,
      siteUrl,
    });
    return NextResponse.json({ url, kind: "portal" });
  }

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "requête invalide" }, { status: 400 });
  }

  const url = await createCheckoutSession({
    userId: auth.userId,
    email: auth.profile.email,
    stripeCustomerId: auth.profile.stripe_customer_id,
    plan: parsed.data.plan,
    cycle: parsed.data.cycle,
    siteUrl,
  });

  return NextResponse.json({ url, kind: "checkout" });
}
