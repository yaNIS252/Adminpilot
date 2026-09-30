import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { invalidId, readJson, readUuid } from "@/lib/http/request";
import { getSignedUrl } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Une lettre de résiliation : téléchargement (GET) et suivi (PATCH).
 *
 * La propriété est toujours vérifiée par une lecture sous l'identité de
 * l'utilisateur, avant toute action faite avec la clé de service.
 */

async function ownedLetter(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cancellations")
    .select("id, subscription_id, letter_url, status")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const id = readUuid((await params).id);
  if (!id) return invalidId();

  const letter = await ownedLetter(id);
  if (!letter?.letter_url) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  // URL courte : le lien ne doit pas rester utilisable s'il est recopié.
  const url = await getSignedUrl(letter.letter_url, 120);
  return NextResponse.redirect(url, 303);
}

const PatchSchema = z.object({
  status: z.enum(["sent", "confirmed", "generated"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const id = readUuid((await params).id);
  if (!id) return invalidId();

  const body = await readJson(request, PatchSchema);
  if (!body.ok) return body.response;

  const letter = await ownedLetter(id);
  if (!letter) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  const db = createAdminClient();
  const { status } = body.data;
  const now = new Date().toISOString();

  const { error } = await db
    .from("cancellations")
    .update({
      status,
      // Date d'envoi gardée au passage à « confirmée » : c'est elle qui compte
      // en cas de litige sur le préavis.
      ...(status === "sent" ? { sent_at: now } : {}),
      ...(status === "generated" ? { sent_at: null } : {}),
    })
    .eq("id", letter.id);
  if (error) throw error;

  if (status === "confirmed") {
    // Résiliation confirmée par le fournisseur : l'abonnement sort du total
    // mensuel et ses rappels d'échéance à venir n'ont plus d'objet.
    await db
      .from("subscriptions")
      .update({ status: "cancelled", cancelled_at: now })
      .eq("id", letter.subscription_id)
      .eq("user_id", auth.userId);
    await db
      .from("alerts")
      .delete()
      .eq("user_id", auth.userId)
      .eq("ref_id", letter.subscription_id)
      .is("sent_at", null);
  }

  return NextResponse.json({ status });
}
