import "server-only";

import type { Resend } from "resend";

import { escapeHtml } from "@/lib/alerts/email";
import { FEEDBACK_EMAIL_DAYS, FEEDBACK_PROMPT_DAYS } from "@/lib/constants";
import { senderAddress } from "@/lib/email/sender";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/** Carte « Ton avis » à afficher : deux semaines passées, ni réponse ni refus. */
export function isFeedbackDue(profile: {
  created_at: string;
  feedback_at: string | null;
  feedback_dismissed_at: string | null;
}): boolean {
  if (profile.feedback_at || profile.feedback_dismissed_at) return false;
  return Date.now() - new Date(profile.created_at).getTime() >= FEEDBACK_PROMPT_DAYS * 86_400_000;
}

/**
 * Demande d'avis par e-mail, un mois après l'inscription, aux comptes qui
 * n'ont pas répondu à la carte de l'application. Une seule fois par compte.
 *
 * Les étoiles de l'e-mail mènent à /avis avec la note présélectionnée : un
 * lien ne doit rien enregistrer tout seul (les antivirus de messagerie les
 * ouvrent), l'utilisateur confirme d'un clic.
 */
export async function sendFeedbackRequests(input: {
  db: Db;
  resend: Resend;
  siteUrl: string;
}): Promise<{ sent: number }> {
  const cutoff = new Date(Date.now() - FEEDBACK_EMAIL_DAYS * 86_400_000).toISOString();
  const { data: profiles, error } = await input.db
    .from("profiles")
    .select("id, email, name")
    .lte("created_at", cutoff)
    .is("feedback_at", null)
    .is("feedback_email_sent_at", null)
    .is("deleted_at", null)
    .limit(50);
  if (error) throw error;

  let sent = 0;
  for (const profile of profiles ?? []) {
    await input.db
      .from("profiles")
      .update({ feedback_email_sent_at: new Date().toISOString() })
      .eq("id", profile.id);

    const hello = profile.name ? `Bonjour ${profile.name},` : "Bonjour,";
    const intro =
      "Tu utilises AdminPilot depuis un mois. Qu’en penses-tu ? Ta note nous aide à savoir quoi améliorer en priorité.";
    const stars = [1, 2, 3, 4, 5]
      .map(
        (n) =>
          `<a href="${input.siteUrl}/avis?note=${n}" style="display:inline-block;margin:0 3px;font-size:30px;line-height:1;color:#6c5ce7;text-decoration:none" title="${n} sur 5">★</a>`,
      )
      .join("");

    try {
      const { error: sendError } = await input.resend.emails.send({
        from: senderAddress(),
        to: profile.email,
        subject: "Ton avis sur AdminPilot ?",
        text: `${hello}\n\n${intro}\n\nDonner ma note (30 secondes) : ${input.siteUrl}/avis\n\nTu peux aussi répondre directement à cet e-mail.`,
        html: `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f5f5fa;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a2e">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
    <p style="margin:0 0 8px;font-size:13px;color:#6b6b80">Ton avis</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700">Un mois avec AdminPilot</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6">${escapeHtml(hello)}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6">${escapeHtml(intro)}</p>
    <p style="margin:0 0 6px;text-align:center">${stars}</p>
    <p style="margin:0 0 20px;text-align:center;font-size:12px;color:#6b6b80">Clique sur une étoile</p>
    <p style="margin:0;font-size:13px;color:#6b6b80">Tu peux aussi répondre directement à cet e-mail : on lit tout.</p>
  </div>
</body></html>`,
      });
      if (!sendError) sent += 1;
    } catch (sendError) {
      console.error("[cron] demande d'avis:", sendError);
    }
  }
  return { sent };
}

/** Transmet un avis à l'adresse du support. Ne lève pas. */
export async function relayFeedback(input: {
  resend: Resend;
  email: string;
  rating: number;
  comment: string | null;
}): Promise<void> {
  const to = process.env.SUPPORT_FORWARD_TO?.trim();
  if (!to) return;
  try {
    await input.resend.emails.send({
      from: senderAddress(),
      to,
      replyTo: input.email,
      subject: `[Avis ${input.rating}/5] ${input.email}`,
      text: `Note : ${"★".repeat(input.rating)}${"☆".repeat(5 - input.rating)} (${input.rating}/5)\nDe : ${input.email}\n\n${input.comment ?? "(pas de commentaire)"}`,
    });
  } catch (error) {
    console.error("[avis] relais support:", error);
  }
}
