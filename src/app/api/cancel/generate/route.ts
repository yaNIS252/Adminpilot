import { NextResponse } from "next/server";
import { z } from "zod";

import { MODEL_ACCURATE, getAnthropic } from "@/lib/ai/client";
import { requireUser } from "@/lib/auth/require-user";
import { checkLimit, incrementUsage } from "@/lib/billing/quotas";
import { CANCEL_LETTER_SYSTEM, LEGAL_TEMPLATES } from "@/lib/cancel/templates";
import { renderLetterPdf } from "@/lib/cancel/generate-pdf";
import { readJson } from "@/lib/http/request";
import { consume, tooManyRequests } from "@/lib/rate-limit";
import { buildKey, uploadRaw } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Génère une lettre de résiliation conforme, puis son PDF.
 *
 * Le modèle rédige, il ne choisit pas la base légale : celle-ci vient de
 * `known_providers.legal_basis`, donnée vérifiée à la main. Une lettre qui
 * invoque le mauvais article donne au fournisseur un motif de refus, et
 * l'utilisateur l'apprend après reconduction — trop tard.
 *
 * On emploie Sonnet et non Haiku : c'est un document juridique que
 * l'utilisateur enverra tel quel, pas une classification de masse.
 */

const BodySchema = z.object({
  subscriptionId: z.string().uuid(),
  sender: z.object({
    name: z.string().min(1).max(120),
    address: z.array(z.string().max(120)).max(5),
  }),
  place: z.string().min(1).max(80),
  /** Référence du contrat, si l'utilisateur la connaît. */
  reference: z.string().max(80).nullable().default(null),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const parsedBody = await readJson(request, BodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const input = parsedBody.data;

  // Limite de débit horaire, en plus du quota mensuel.
  //
  // Cette route appelle Sonnet avec 2048 tokens de sortie : c'est de loin
  // l'appel le plus coûteux du produit. Le seul garde-fou était le quota
  // mensuel du plan — or il vaut `null`, donc illimité, sur la formule Famille.
  // Un compte à 9,99 € pouvait ainsi lancer des générations en rafale sans
  // aucune borne. Le compteur existait dans `LIMITS.cancel` ; il n'était
  // simplement jamais consommé.
  if (!(await consume("cancel", auth.userId))) {
    return tooManyRequests("cancel");
  }

  const quota = await checkLimit(
    auth.userId,
    auth.profile.plan,
    "cancellations",
  );
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "quota atteint", feature: "cancellations", ...quota },
      { status: 402 },
    );
  }

  // Lecture sous l'identité de l'utilisateur : la policy RLS garantit qu'il
  // ne peut pas générer une lettre à partir de l'abonnement d'un autre.
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*, known_providers(name, cancel_address, legal_basis)")
    .eq("id", input.subscriptionId)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json({ error: "abonnement introuvable" }, { status: 404 });
  }

  const provider = sub.known_providers as unknown as {
    name: string;
    cancel_address: string | null;
    legal_basis: keyof typeof LEGAL_TEMPLATES;
  } | null;

  // Fournisseur hors catalogue : on retombe sur le régime le moins engageant
  // plutôt que d'invoquer une loi qui ne s'applique peut-être pas.
  const basis = provider?.legal_basis ?? "libre";
  const template = LEGAL_TEMPLATES[basis];

  const client = getAnthropic();
  const response = await client.messages.create({
    model: MODEL_ACCURATE,
    max_tokens: 2048,
    system: CANCEL_LETTER_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Rédige le corps de la lettre.

Fournisseur : ${provider?.name ?? sub.provider}
Référence du contrat : ${input.reference ?? "inconnue"}
Montant : ${sub.amount ?? "inconnu"} ${sub.currency}
Base légale à citer, mot pour mot : ${template.clause}
Fondement : ${template.article}

N'invente aucune information manquante : laisse un [à compléter : ...].`,
      },
    ],
  });

  const body = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!body) {
    return NextResponse.json(
      { error: "génération de la lettre en échec" },
      { status: 502 },
    );
  }

  const subject = `Résiliation du contrat ${input.reference ? `n° ${input.reference}` : `${provider?.name ?? sub.provider}`}`;

  const pdf = await renderLetterPdf({
    sender: input.sender,
    recipient: {
      name: provider?.name ?? sub.provider,
      address: provider?.cancel_address
        ? provider.cancel_address.split("\n")
        : ["[à compléter : adresse du service résiliation]"],
    },
    place: input.place,
    date: new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date()),
    subject,
    body,
  });

  const key = buildKey({
    userId: auth.userId,
    source: "upload",
    contentHash: `resiliation-${input.subscriptionId}`,
    extension: "pdf",
  });

  await uploadRaw({ key, body: pdf, contentType: "application/pdf" });

  const db = createAdminClient();
  await db.from("cancellations").upsert(
    {
      user_id: auth.userId,
      subscription_id: input.subscriptionId,
      template_used: basis,
      letter_content: body,
      letter_url: key,
      status: "generated",
    },
    { onConflict: "subscription_id" },
  );

  await incrementUsage(auth.userId, "cancellations");

  return NextResponse.json({
    letterContent: body,
    letterUrl: key,
    legalBasis: basis,
    // Rappelé à l'écran : la lettre peut être parfaite et arriver trop tard.
    timing: template.timing,
  });
}
