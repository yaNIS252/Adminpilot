import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { ACCENTS, BACKGROUNDS } from "@/lib/constants";
import { readJson } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Personnalisation du profil : prénom affiché et thème de l'interface
 * (couleur d'accent et fond).
 *
 * Écrit avec la clé de service après validation : les thèmes sont des listes
 * fermées dont une partie est réservée aux formules payantes, ce qu'aucune
 * policy RLS ne sait exprimer.
 */

const BodySchema = z
  .object({
    // Espaces aux bords retirés ; une chaîne vide efface le prénom.
    name: z.string().trim().max(60).optional(),
    accent: z.enum(ACCENTS.map((accent) => accent.id) as [string, ...string[]]).optional(),
    background: z
      .enum(BACKGROUNDS.map((background) => background.id) as [string, ...string[]])
      .optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "rien à modifier",
  });

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const body = await readJson(request, BodySchema);
  if (!body.ok) return body.response;

  const update: {
    name?: string | null;
    accent?: string;
    background?: string;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (body.data.name !== undefined) {
    update.name = body.data.name === "" ? null : body.data.name;
  }

  const lockedAccent = ACCENTS.find((item) => item.id === body.data.accent);
  const lockedBackground = BACKGROUNDS.find((item) => item.id === body.data.background);
  if (
    auth.profile.plan === "free" &&
    ((lockedAccent && !lockedAccent.free) || (lockedBackground && !lockedBackground.free))
  ) {
    return NextResponse.json(
      { error: "thème réservé aux formules payantes", code: "upgrade_required" },
      { status: 402 },
    );
  }
  if (body.data.accent !== undefined) update.accent = body.data.accent;
  if (body.data.background !== undefined) update.background = body.data.background;

  const { error } = await createAdminClient()
    .from("profiles")
    .update(update)
    .eq("id", auth.userId);
  if (error) throw error;

  return NextResponse.json({ ok: true });
}
