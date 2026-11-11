import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { fetchPageText, judgeCancelPage, onDomain } from "@/lib/cancel/suggest";
import { readJson } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * « Proposer le lien de résiliation » sur un abonnement.
 *
 * Le lien n'est utilisé que s'il passe la vérification (domaine, page
 * accessible, lecture par l'IA à 0,8 au moins) : tout de suite pour cet
 * utilisateur, et pour tout le monde dans le catalogue quand trois comptes
 * différents ont proposé le même. Cinq propositions par jour et par compte.
 */

const DAILY_LIMIT = 5;
const ACCEPT_CONFIDENCE = 0.8;
const CATALOGUE_CONFIRMATIONS = 3;

const BodySchema = z.object({
  url: z
    .string()
    .trim()
    .max(2000)
    .url()
    .refine((value) => value.startsWith("https://"), { message: "https uniquement" }),
});

function hostOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "identifiant invalide" }, { status: 400 });
  }
  const body = await readJson(request, BodySchema);
  if (!body.ok) {
    return NextResponse.json({ error: "Colle une adresse complète qui commence par https://." }, { status: 400 });
  }

  // Lecture par le client de l'utilisateur : RLS garantit que c'est le sien.
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, provider, provider_id, metadata, known_providers(name, domain)")
    .eq("id", id)
    .maybeSingle();
  if (!sub) return NextResponse.json({ error: "abonnement introuvable" }, { status: 404 });

  const db = createAdminClient();
  const { count } = await db
    .from("cancel_link_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.userId)
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: `Tu as déjà proposé ${DAILY_LIMIT} liens aujourd’hui. Réessaie demain.` },
      { status: 429 },
    );
  }

  // Domaines du fournisseur : catalogue, puis ceux vus dans ses e-mails.
  const catalogue = sub.known_providers as unknown as { name: string; domain: string } | null;
  const meta = (sub.metadata ?? {}) as Record<string, unknown>;
  const domains = [catalogue?.domain, hostOf(meta.site_url), hostOf(meta.manage_url)]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/^www\./, ""));
  if (!domains.length) {
    return NextResponse.json(
      { error: "On ne connaît pas encore le site officiel de ce fournisseur : impossible de vérifier ce lien." },
      { status: 422 },
    );
  }

  const url = body.data.url;
  if (!onDomain(new URL(url).hostname, domains)) {
    return NextResponse.json(
      { error: `Ce lien n’est pas sur le site officiel de ${sub.provider} (${domains[0]}).` },
      { status: 422 },
    );
  }

  let verdict;
  try {
    const text = await fetchPageText(url, domains);
    verdict = await judgeCancelPage({ provider: sub.provider, url, text });
  } catch (error) {
    verdict = {
      isCancelPage: false,
      confidence: 0,
      reason: `Page impossible à vérifier : ${error instanceof Error ? error.message : "erreur"}.`,
    };
  }
  const accepted = verdict.isCancelPage && verdict.confidence >= ACCEPT_CONFIDENCE;

  await db.from("cancel_link_suggestions").insert({
    provider_id: sub.provider_id,
    subscription_id: sub.id,
    user_id: auth.userId,
    url,
    status: "pending",
    ai_verdict: verdict,
  });

  if (!accepted) {
    return NextResponse.json({ accepted: false, reason: verdict.reason });
  }

  // Utilisé tout de suite pour cet utilisateur.
  await db
    .from("subscriptions")
    .update({ metadata: { ...meta, manage_url: url, manage_url_source: "user" } })
    .eq("id", sub.id);

  // Trois comptes différents, même lien, même verdict : il entre au catalogue.
  let promoted = false;
  if (sub.provider_id) {
    const { data: same } = await db
      .from("cancel_link_suggestions")
      .select("user_id, ai_verdict")
      .eq("provider_id", sub.provider_id)
      .eq("url", url);
    const users = new Set(
      (same ?? [])
        .filter((row) => {
          const v = row.ai_verdict as { isCancelPage?: boolean; confidence?: number } | null;
          return v?.isCancelPage && (v.confidence ?? 0) >= ACCEPT_CONFIDENCE;
        })
        .map((row) => row.user_id),
    );
    if (users.size >= CATALOGUE_CONFIRMATIONS) {
      await db
        .from("known_providers")
        .update({ cancel_url: url, verified_at: new Date().toISOString() })
        .eq("id", sub.provider_id);
      await db
        .from("cancel_link_suggestions")
        .update({ status: "approved" })
        .eq("provider_id", sub.provider_id)
        .eq("url", url);
      promoted = true;
    }
  }

  return NextResponse.json({ accepted: true, promoted, reason: verdict.reason });
}
