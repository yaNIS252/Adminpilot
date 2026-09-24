import "server-only";

/**
 * Gabarit des emails d'alerte.
 *
 * Écrit en HTML inline volontairement : les clients mail ignorent les
 * feuilles de style externes et une bonne part d'entre eux rognent le CSS
 * embarqué. Ce qui compte ici n'est pas l'élégance, c'est que le message
 * reste lisible dans Outlook comme dans Gmail mobile.
 */

export type AlertEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAmount(amount: number | null, currency: string): string | null {
  if (amount === null) return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function buildRenewalEmail(input: {
  provider: string;
  amount: number | null;
  currency: string;
  renewalDate: string;
  daysLeft: number;
  dashboardUrl: string;
  /** Faux tant que l'utilisateur n'a pas validé l'extraction. */
  confirmed: boolean;
}): AlertEmail {
  const amount = formatAmount(input.amount, input.currency);
  const when =
    input.daysLeft === 0
      ? "aujourd'hui"
      : input.daysLeft === 1
        ? "demain"
        : `dans ${input.daysLeft} jours`;

  const subject = amount
    ? `${input.provider} — ${amount} prélevés ${when}`
    : `${input.provider} se renouvelle ${when}`;

  // Une donnée non confirmée par l'utilisateur ne doit jamais être présentée
  // comme un fait : elle vient d'une extraction automatique faillible.
  const caveat = input.confirmed
    ? ""
    : `<p style="margin:16px 0 0;font-size:13px;color:#6b6b80">Ce montant a été détecté automatiquement et n'a pas encore été vérifié par tes soins.</p>`;

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f5f5fa;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a2e">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
    <p style="margin:0 0 8px;font-size:13px;color:#6b6b80">Échéance à venir</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700">${escapeHtml(input.provider)}</h1>
    <p style="margin:0;font-size:15px;line-height:1.6">
      ${amount ? `<strong>${escapeHtml(amount)}</strong> seront prélevés ` : "Ton contrat se renouvelle "}${when}, le ${formatDate(input.renewalDate)}.
    </p>
    ${caveat}
    <p style="margin:24px 0 0">
      <a href="${input.dashboardUrl}" style="display:inline-block;background:#6c5ce7;color:#fff;text-decoration:none;padding:11px 20px;border-radius:7px;font-size:14px;font-weight:600">Voir dans AdminPilot</a>
    </p>
  </div>
</body></html>`;

  const text = `${input.provider} — échéance ${when} (${formatDate(input.renewalDate)})${amount ? `\nMontant : ${amount}` : ""}${input.confirmed ? "" : "\nDonnée détectée automatiquement, non vérifiée."}\n\n${input.dashboardUrl}`;

  return { subject, html, text };
}

export function buildDeadlineEmail(input: {
  title: string;
  deadline: string;
  daysLeft: number;
  dashboardUrl: string;
}): AlertEmail {
  const when =
    input.daysLeft === 0
      ? "aujourd'hui"
      : input.daysLeft === 1
        ? "demain"
        : `dans ${input.daysLeft} jours`;

  const subject = `${input.title} — échéance ${when}`;

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f5f5fa;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a2e">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
    <p style="margin:0 0 8px;font-size:13px;color:#6b6b80">Échéance à venir</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700">${escapeHtml(input.title)}</h1>
    <p style="margin:0;font-size:15px;line-height:1.6">À traiter ${when}, le ${formatDate(input.deadline)}.</p>
    <p style="margin:24px 0 0">
      <a href="${input.dashboardUrl}" style="display:inline-block;background:#6c5ce7;color:#fff;text-decoration:none;padding:11px 20px;border-radius:7px;font-size:14px;font-weight:600">Voir le document</a>
    </p>
  </div>
</body></html>`;

  return {
    subject,
    html,
    text: `${input.title} — échéance ${when} (${formatDate(input.deadline)})\n\n${input.dashboardUrl}`,
  };
}
