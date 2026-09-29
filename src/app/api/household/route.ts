import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { INVITE_TTL_DAYS } from "@/lib/constants";
import { invalidId, readJson, readUuid } from "@/lib/http/request";
import {
  INVITE_SLOTS,
  membershipOf,
  newInviteToken,
  revokeMemberPlan,
  sendInviteEmail,
} from "@/lib/household";
import { consume, tooManyRequests } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Foyer Premium, côté titulaire : inviter (POST), retirer un membre ou
 * annuler une invitation (DELETE).
 */

const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().max(60).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  // `stripe_sub_id` distingue le titulaire d'un membre, qui est lui aussi en
  // Premium mais ne peut pas inviter à son tour.
  if (auth.profile.plan !== "family" || !auth.profile.stripe_sub_id) {
    return NextResponse.json(
      { error: "réservé au titulaire d'un abonnement Premium", code: "upgrade_required" },
      { status: 402 },
    );
  }

  const body = await readJson(request, InviteSchema);
  if (!body.ok) return body.response;
  const { email, name } = body.data;

  if (email === auth.profile.email.toLowerCase()) {
    return NextResponse.json(
      { error: "tu fais déjà partie de ton foyer", code: "self" },
      { status: 400 },
    );
  }

  if (!(await consume("invite", auth.userId))) {
    return tooManyRequests("invite");
  }

  const db = createAdminClient();

  const { data: existing, error: listError } = await db
    .from("family_members")
    .select("id, email, member_id")
    .eq("owner_id", auth.userId);
  if (listError) throw listError;

  const already = existing?.find((row) => row.email === email);
  if (already?.member_id) {
    return NextResponse.json(
      { error: "déjà membre du foyer", code: "already_member" },
      { status: 409 },
    );
  }
  // Renvoyer une invitation à la même adresse ne consomme pas de place.
  if (!already && (existing?.length ?? 0) >= INVITE_SLOTS) {
    return NextResponse.json(
      { error: "foyer complet", code: "household_full" },
      { status: 409 },
    );
  }

  const { token, hash } = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

  const { error } = await db.from("family_members").upsert(
    {
      owner_id: auth.userId,
      email,
      name: name || null,
      token_hash: hash,
      expires_at: expiresAt.toISOString(),
      invited_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,email" },
  );
  if (error) throw error;

  const link = `${siteUrl()}/rejoindre/${token}`;
  const emailed = await sendInviteEmail({
    to: email,
    ownerName: auth.profile.name ?? auth.profile.email,
    link,
  });

  // Le lien n'est renvoyé qu'ici, une fois : la base n'en garde que
  // l'empreinte et ne pourra jamais le réafficher.
  return NextResponse.json({ link, emailed }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const id = readUuid(new URL(request.url).searchParams.get("id"));
  if (!id) return invalidId();

  const db = createAdminClient();
  const { data: row } = await db
    .from("family_members")
    .select("id, member_id")
    .eq("id", id)
    .eq("owner_id", auth.userId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  const { error } = await db.from("family_members").delete().eq("id", row.id);
  if (error) throw error;

  if (row.member_id) await revokeMemberPlan(db, row.member_id);

  return NextResponse.json({ removed: true });
}

/** Utilisé par la page de réglages d'un membre : quitter le foyer. */
export async function PATCH() {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const db = createAdminClient();
  const membership = await membershipOf(db, auth.userId);
  if (!membership) {
    return NextResponse.json({ error: "aucun foyer" }, { status: 404 });
  }

  const { error } = await db
    .from("family_members")
    .delete()
    .eq("id", membership.id);
  if (error) throw error;

  await revokeMemberPlan(db, auth.userId);
  return NextResponse.json({ left: true });
}
