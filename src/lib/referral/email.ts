import "server-only";

import { Resend } from "resend";

import { escapeHtml } from "@/lib/alerts/email";
import { senderAddress } from "@/lib/email/sender";
import { siteUrl } from "@/lib/site-url";

/**
 * Prévient le parrain que son mois offert est validé. Ne lève pas : un échec
 * d'envoi ne doit pas annuler la récompense, déjà accordée en base.
 */
export async function sendReferralValidated(input: {
  to: string;
  refereeLabel: string;
  reward: "bonus" | "credit";
  bonusUntil: Date | null;
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;

  const base = siteUrl();
  const until = input.bonusUntil
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(
        input.bonusUntil,
      )
    : null;

  const lines = [
    `${input.refereeLabel}, que tu as parrainé, utilise maintenant AdminPilot. Merci de l’avoir fait connaître !`,
    input.reward === "credit"
      ? "Ton mois offert est déduit de ta prochaine facture : le crédit apparaît déjà sur ton compte."
      : until
        ? `Ton mois de Pro offert est actif jusqu’au ${until}.`
        : "Ton mois de Pro offert est actif.",
  ];

  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: senderAddress(),
      to: input.to,
      subject: "Ton mois offert est validé",
      text: `${lines.join("\n\n")}\n\nSuivre tes parrainages : ${base}/reglages#parrainage`,
      html: `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f5f5fa;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a2e">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
    <p style="margin:0 0 8px;font-size:13px;color:#6b6b80">Parrainage</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700">Ton mois offert est validé</h1>
    ${lines.map((line) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">${escapeHtml(line)}</p>`).join("")}
    <p style="margin:20px 0 0;font-size:13px;color:#6b6b80"><a href="${base}/reglages#parrainage" style="color:#6c5ce7">Suivre tes parrainages</a></p>
  </div>
</body></html>`,
    });
    return !error;
  } catch {
    return false;
  }
}
