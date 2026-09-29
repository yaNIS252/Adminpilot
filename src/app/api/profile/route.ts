import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { ACCENTS } from "@/lib/constants";
import { readJson } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Personnalisation du profil : prénom affiché et couleur de l'interface.
 *
 * Écrit avec la clé de service après validation : la couleur est une liste
 * fermée dont une partie est réservée aux formules payantes, ce qu'aucune
 * policy RLS ne sait exprimer.
 */

const BodySchema = z
  .object({
    // Espaces aux bords retirés ; une chaîne vide efface le prénom.
    name: z.string().trim().max(60).optional(),
    accent: z.enum(ACCENTS.map((accent) => accent.id) as [string, ...string[]]).optional(),
  })
  .refine((body) => body.name !== undefined || body.accent !== undefined, {
    message: "rien à modifier",
  });

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const body = await readJson(request, BodySchema);
  if (!body.ok) return body.response;

  const update: { name?: string | null; accent?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (body.data.name !== undefined) {
    update.name = body.data.name === "" ? null : body.data.name;
  }

  if (body.data.accent !== undefined) {
    const accent = ACCENTS.find((item) => item.id === body.data.accent);
    if (!accent?.free && auth.profile.plan === "free") {
      return NextResponse.json(
        { error: "couleur réservée aux formules payantes", code: "upgrade_required" },
        { status: 402 },
      );
    }
    update.accent = body.data.accent;
  }

  const { error } = await createAdminClient()
    .from("profiles")
    .update(update)
    .eq("id", auth.userId);
  if (error) throw error;

  return NextResponse.json({ ok: true });
}
