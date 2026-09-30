import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { checkLimit, incrementUsage } from "@/lib/billing/quotas";
import { renderLetterPdf } from "@/lib/cancel/generate-pdf";
import { buildLetter } from "@/lib/cancel/letter";
import { LEGAL_TEMPLATES } from "@/lib/cancel/templates";
import { readJson } from "@/lib/http/request";
import { consume, tooManyRequests } from "@/lib/rate-limit";
import { deleteRaw, uploadRaw } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Génère une lettre de résiliation et son PDF.
 *
 * La base légale ne vient jamais de l'utilisateur ni d'un modèle : elle est
 * lue dans `known_providers.legal_basis`, donnée vérifiée à la main. Une
 * lettre qui invoque le mauvais article donne au fournisseur un motif de
 * refus, et l'utilisateur l'apprend après reconduction — trop tard. Hors
 * catalogue, on retombe sur le régime le moins engageant.
 */

const line = z.string().trim().min(1).max(120);

const BodySchema = z.object({
  subscriptionId: z.string().uuid(),
  sender: z.object({
    name: line,
    // Rue et ville au minimum : sans adresse, le fournisseur ne peut pas
    // rattacher le courrier au contrat.
    address: z.array(line).min(2).max(4),
  }),
  /** Adresse du service résiliation, pré-remplie quand le catalogue la connaît. */
  recipientAddress: z.array(line).min(2).max(5),
  place: line.max(80),
  /** Référence du contrat ou numéro client, si l'utilisateur la connaît. */
  reference: z.string().trim().max(80).nullable().default(null),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const parsedBody = await readJson(request, BodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const input = parsedBody.data;

  const quota = await checkLimit(auth.userId, auth.profile.plan, "cancellations");
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "quota atteint", feature: "cancellations", ...quota },
      { status: 402 },
    );
  }

  // Borne horaire en plus du quota mensuel, qui est illimité en payant :
  // chaque génération rend un PDF et écrit un fichier.
  if (!(await consume("cancel", auth.userId))) {
    return tooManyRequests("cancel");
  }

  // Lecture sous l'identité de l'utilisateur : la policy RLS garantit qu'il
  // ne peut pas générer une lettre à partir de l'abonnement d'un autre.
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, provider, known_providers(name, legal_basis)")
    .eq("id", input.subscriptionId)
    .eq("over_quota", false)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json({ error: "abonnement introuvable" }, { status: 404 });
  }

  const catalogue = sub.known_providers as unknown as {
    name: string;
    legal_basis: keyof typeof LEGAL_TEMPLATES;
  } | null;
  const basis = catalogue?.legal_basis ?? "libre";
  const providerName = catalogue?.name ?? sub.provider;

  const letter = buildLetter({
    provider: providerName,
    basis,
    reference: input.reference,
  });

  const pdf = await renderLetterPdf({
    sender: input.sender,
    recipient: { name: providerName, address: input.recipientAddress },
    place: input.place,
    date: new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date()),
    subject: letter.subject,
    body: letter.body,
  });

  // Un nom neuf à chaque génération : une URL signée déjà ouverte ne doit
  // pas servir l'ancienne version depuis un cache.
  const key = `${auth.userId}/letters/${sub.id}-${Date.now()}.pdf`;
  await uploadRaw({ key, body: pdf, contentType: "application/pdf" });

  const db = createAdminClient();
  const { data: previous } = await db
    .from("cancellations")
    .select("letter_url")
    .eq("subscription_id", sub.id)
    .maybeSingle();

  const { data: saved, error } = await db
    .from("cancellations")
    .upsert(
      {
        user_id: auth.userId,
        subscription_id: sub.id,
        template_used: basis,
        letter_content: letter.body,
        letter_url: key,
        status: "generated",
        sent_at: null,
      },
      { onConflict: "subscription_id" },
    )
    .select("id")
    .single();
  if (error) throw error;

  if (previous?.letter_url && previous.letter_url !== key) {
    await deleteRaw(previous.letter_url).catch(() => undefined);
  }

  await incrementUsage(auth.userId, "cancellations");

  return NextResponse.json({
    id: saved.id,
    legalBasis: basis,
    // Rappelé à l'écran : la lettre peut être parfaite et arriver trop tard.
    timing: LEGAL_TEMPLATES[basis].timing,
  });
}
