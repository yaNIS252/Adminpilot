import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { unlockHiddenSubscriptions } from "@/lib/billing/sync";
import { readJson } from "@/lib/http/request";
import { hashToken, membershipOf } from "@/lib/household";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Acceptation d'une invitation au foyer.
 *
 * Toujours sur un clic explicite, jamais à la simple ouverture du lien : un
 * aperçu de lien (messagerie, antivirus) ouvre l'URL tout seul, et ne doit pas
 * rattacher quelqu'un à un foyer à son insu.
 */

const BodySchema = z.object({ token: z.string().min(20).max(100) });

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const body = await readJson(request, BodySchema);
  if (!body.ok) return body.response;

  const db = createAdminClient();
  const { data: invite } = await db
    .from("family_members")
    .select(
      "id, owner_id, member_id, expires_at, owner:profiles!family_members_owner_id_fkey(plan)",
    )
    .eq("token_hash", hashToken(body.data.token))
    .maybeSingle();

  if (!invite || invite.member_id) {
    return NextResponse.json(
      { error: "invitation introuvable ou déjà utilisée", code: "invalid" },
      { status: 404 },
    );
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "invitation expirée", code: "expired" }, { status: 410 });
  }
  if (invite.owner_id === auth.userId) {
    return NextResponse.json({ error: "c'est ton propre foyer", code: "self" }, { status: 400 });
  }
  if (invite.owner?.plan !== "family") {
    return NextResponse.json(
      { error: "le foyer n'est plus actif", code: "inactive" },
      { status: 409 },
    );
  }
  if (await membershipOf(db, auth.userId)) {
    return NextResponse.json(
      { error: "déjà membre d'un foyer", code: "already_member" },
      { status: 409 },
    );
  }
  // Un abonné payant qui rejoindrait continuerait d'être débité pour rien.
  if (auth.profile.plan !== "free") {
    return NextResponse.json(
      { error: "abonnement personnel en cours", code: "has_subscription" },
      { status: 409 },
    );
  }

  // `member_id is null` dans la condition : deux clics simultanés sur le même
  // lien ne peuvent pas rattacher deux comptes.
  const { data: joined, error } = await db
    .from("family_members")
    .update({
      member_id: auth.userId,
      joined_at: new Date().toISOString(),
      token_hash: null,
      expires_at: null,
      // Le prénom choisi par le membre remplace celui saisi par le titulaire.
      ...(auth.profile.name ? { name: auth.profile.name } : {}),
    })
    .eq("id", invite.id)
    .is("member_id", null)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!joined) {
    return NextResponse.json(
      { error: "invitation déjà utilisée", code: "invalid" },
      { status: 409 },
    );
  }

  await db
    .from("profiles")
    .update({ plan: "family", updated_at: new Date().toISOString() })
    .eq("id", auth.userId);
  await unlockHiddenSubscriptions(db, auth.userId);

  return NextResponse.json({ joined: true });
}
