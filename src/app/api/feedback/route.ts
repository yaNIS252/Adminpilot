import { after, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { relayFeedback } from "@/lib/feedback";
import { readJson } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Avis de l'utilisateur (note sur 5 et commentaire facultatif), ou carte
 * « Ton avis » refermée sans répondre. Chaque avis est aussi transmis au
 * support, pour être lu sans aller fouiller la base.
 */

const BodySchema = z.union([
  z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).optional(),
  }),
  z.object({ dismiss: z.literal(true) }),
]);

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const body = await readJson(request, BodySchema);
  if (!body.ok) return body.response;

  const db = createAdminClient();
  const now = new Date().toISOString();

  if ("dismiss" in body.data) {
    const { error } = await db
      .from("profiles")
      .update({ feedback_dismissed_at: now })
      .eq("id", auth.userId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  }

  const rating = body.data.rating;
  const comment = body.data.comment || null;
  const { error } = await db
    .from("profiles")
    .update({ feedback_rating: rating, feedback_comment: comment, feedback_at: now })
    .eq("id", auth.userId);
  if (error) throw error;

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    after(() => relayFeedback({ resend, email: auth.profile.email, rating, comment }));
  }

  return NextResponse.json({ ok: true });
}
