import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { Resend } from "resend";

import { FAMILY_SEATS } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Foyer Premium.
 *
 * Le titulaire d'un abonnement Premium invite jusqu'à `FAMILY_SEATS - 1`
 * personnes. Chacune garde son compte, son adresse d'ingestion et ses
 * données, que personne d'autre ne voit : le foyer partage la formule, pas le
 * contenu. C'est ce qui permet à quelqu'un de rejoindre sans rien exposer.
 *
 * L'invitation est un lien porteur d'un jeton aléatoire, montré une seule
 * fois. Seule son empreinte est stockée.
 */

type Db = ReturnType<typeof createAdminClient>;

export const INVITE_SLOTS = FAMILY_SEATS - 1;

export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Le foyer dont l'utilisateur est membre, avec son titulaire. */
export async function membershipOf(db: Db, userId: string) {
  const { data } = await db
    .from("family_members")
    .select(
      "id, joined_at, owner:profiles!family_members_owner_id_fkey(id, name, email, plan)",
    )
    .eq("member_id", userId)
    .maybeSingle();
  return data;
}

/** Invitations et membres du foyer dont l'utilisateur est titulaire. */
export async function householdOf(db: Db, ownerId: string) {
  const { data, error } = await db
    .from("family_members")
    .select(
      "id, email, name, invited_at, joined_at, expires_at, member:profiles!family_members_member_id_fkey(id, name, email, avatar_path)",
    )
    .eq("owner_id", ownerId)
    .order("invited_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Envoie l'invitation par e-mail. Ne lève jamais : le lien est aussi affiché
 * au titulaire, qui peut le transmettre lui-même si l'envoi échoue.
 */
export async function sendInviteEmail(input: {
  to: string;
  ownerName: string;
  link: string;
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;

  const domain = process.env.INBOUND_DOMAIN ?? "in.zylax.fr";
  const owner = escapeHtml(input.ownerName);

  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: `AdminPilot <no-reply@${domain}>`,
      to: input.to,
      subject: `${input.ownerName} t’invite à rejoindre son foyer AdminPilot`,
      text: `${input.ownerName} partage avec toi sa formule Premium AdminPilot : abonnements, documents et alertes illimités, sur ton propre compte.\n\nTes données restent privées : personne d'autre, pas même ${input.ownerName}, ne voit tes documents ni tes abonnements.\n\nRejoindre le foyer : ${input.link}\n\nCe lien est personnel et expire dans 14 jours.`,
      html: `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f5f5fa;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a2e">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
    <p style="margin:0 0 8px;font-size:13px;color:#6b6b80">Invitation</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700">${owner} t’invite dans son foyer</h1>
    <p style="margin:0;font-size:15px;line-height:1.6">Tu profites de sa formule Premium sur ton propre compte : abonnements, documents et alertes illimités.</p>
    <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#6b6b80">Tes données restent privées : personne d’autre, pas même ${owner}, ne voit tes documents ni tes abonnements.</p>
    <p style="margin:24px 0 0">
      <a href="${input.link}" style="display:inline-block;background:#6c5ce7;color:#fff;text-decoration:none;padding:11px 20px;border-radius:7px;font-size:14px;font-weight:600">Rejoindre le foyer</a>
    </p>
    <p style="margin:20px 0 0;font-size:12px;color:#8c8ca0">Lien personnel, valable 14 jours.</p>
  </div>
</body></html>`,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Retire l'avantage Premium à un ancien membre.
 *
 * Seulement s'il le tenait du foyer : quelqu'un qui paie son propre Pro le
 * garde. Ses abonnements au-delà du quota gratuit restent visibles — les
 * masquer rétroactivement ferait disparaître des données sous ses yeux ; la
 * limite s'appliquera aux prochaines détections.
 */
export async function revokeMemberPlan(db: Db, memberId: string) {
  await db
    .from("profiles")
    .update({ plan: "free", updated_at: new Date().toISOString() })
    .eq("id", memberId)
    // Un membre ne peut rejoindre qu'en gratuit : s'il est en Premium, il le
    // tient forcément du foyer. Un Pro payé à côté n'est pas touché.
    .eq("plan", "family");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
