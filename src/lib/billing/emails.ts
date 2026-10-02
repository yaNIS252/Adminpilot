import "server-only";

import { Resend } from "resend";

import { escapeHtml } from "@/lib/alerts/email";
import { PLAN_LABELS } from "@/lib/constants";
import { siteUrl } from "@/lib/site-url";
import type { Enums } from "@/lib/supabase/types";

/**
 * Confirmation écrite de résiliation de l'abonnement AdminPilot.
 *
 * Obligatoire : après une résiliation en ligne, le professionnel confirme sur
 * un support durable la date de réception et la date de fin (art. L215-1-1 et
 * D215-1 du Code de la consommation). Ne lève pas : un échec d'envoi ne doit
 * pas faire rejouer le webhook Stripe indéfiniment.
 */
export async function sendCancellationConfirmation(input: {
  to: string;
  plan: Enums<"plan">;
  endsAt: Date | null;
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;

  const domain = process.env.INBOUND_DOMAIN ?? "in.zylax.fr";
  const date = (value: Date) =>
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(value);
  const received = date(new Date());
  const end = input.endsAt ? date(input.endsAt) : null;
  const label = PLAN_LABELS[input.plan] ?? "payante";
  const base = siteUrl();

  const lines = [
    `Nous avons bien reçu, le ${received}, la résiliation de ta formule ${label}.`,
    end
      ? `Elle prendra effet le ${end} : tu gardes tous les avantages jusqu’à cette date, aucun nouveau prélèvement n’aura lieu.`
      : "Elle prend effet immédiatement, aucun nouveau prélèvement n’aura lieu.",
    "Ton compte repasse ensuite en formule gratuite : tes données, tes documents et tes abonnements suivis sont conservés.",
  ];

  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: `AdminPilot <no-reply@${domain}>`,
      to: input.to,
      subject: "Confirmation de ta résiliation AdminPilot",
      text: `${lines.join("\n\n")}\n\nTu peux te réabonner à tout moment : ${base}/reglages`,
      html: `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f5f5fa;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a2e">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
    <p style="margin:0 0 8px;font-size:13px;color:#6b6b80">Confirmation de résiliation</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700">Ta résiliation est enregistrée</h1>
    ${lines.map((line) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">${escapeHtml(line)}</p>`).join("")}
    <p style="margin:20px 0 0;font-size:13px;color:#6b6b80">Tu peux te réabonner à tout moment depuis <a href="${base}/reglages" style="color:#6c5ce7">tes réglages</a>.</p>
  </div>
</body></html>`,
    });
    return !error;
  } catch {
    return false;
  }
}
