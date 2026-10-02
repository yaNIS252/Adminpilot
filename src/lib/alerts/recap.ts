import "server-only";

import type { Resend } from "resend";

import { escapeHtml, type AlertEmail } from "@/lib/alerts/email";
import { periodsPerYear } from "@/lib/ingest/price-tracker";
import { monthlyEquivalent } from "@/lib/format";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Récapitulatif mensuel : ce qui a bougé le mois écoulé et ce qui arrive.
 *
 * Réservé aux formules payantes. Il ne dit que ce que les données disent :
 * pas de « tu as économisé X € » calculé sur des hypothèses — un chiffre
 * enjolivé dans un produit qui parle d'argent finit par se voir.
 */

export type RecapData = {
  period: string;
  monthLabel: string;
  monthlyTotal: number;
  activeCount: number;
  increases: { provider: string; oldAmount: number; newAmount: number; yearly: number }[];
  decreases: { provider: string; oldAmount: number; newAmount: number; yearly: number }[];
  newSubscriptions: { provider: string; amount: number | null; cycle: string }[];
  cancelled: { provider: string; monthly: number }[];
  upcoming: { provider: string; date: string; amount: number | null }[];
  documentsAdded: number;
};

/** Mois couvert par le récapitulatif envoyé à `now` : le mois précédent. */
export function recapPeriod(now = new Date()): { period: string; start: string; end: string } {
  const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const month = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
  const period = `${year}-${String(month).padStart(2, "0")}`;
  const start = `${period}-01T00:00:00Z`;
  const end = new Date(Date.UTC(year, month, 1)).toISOString();
  return { period, start, end };
}

function euros(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

export async function buildRecap(db: Db, userId: string, now = new Date()): Promise<RecapData> {
  const { period, start, end } = recapPeriod(now);
  const today = now.toISOString().slice(0, 10);
  const in30 = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);

  const [active, changes, created, cancelled, documents] = await Promise.all([
    db
      .from("subscriptions")
      .select("provider, amount, cycle, next_renewal")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("over_quota", false),
    db
      .from("price_changes")
      .select("old_amount, new_amount, cycle, kind, subscriptions!inner(provider)")
      .eq("user_id", userId)
      .gte("created_at", start)
      .lt("created_at", end),
    db
      .from("subscriptions")
      .select("provider, amount, cycle")
      .eq("user_id", userId)
      .eq("over_quota", false)
      .gte("detected_at", start)
      .lt("detected_at", end),
    db
      .from("subscriptions")
      .select("provider, amount, cycle")
      .eq("user_id", userId)
      .eq("status", "cancelled")
      .gte("cancelled_at", start)
      .lt("cancelled_at", end),
    db
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", start)
      .lt("created_at", end),
  ]);

  const subs = active.data ?? [];
  const moves = (changes.data ?? []).map((change) => ({
    provider: (change.subscriptions as unknown as { provider: string }).provider,
    oldAmount: Number(change.old_amount),
    newAmount: Number(change.new_amount),
    yearly: (Number(change.new_amount) - Number(change.old_amount)) * periodsPerYear(change.cycle),
    kind: change.kind,
  }));

  return {
    period,
    monthLabel: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
      new Date(start),
    ),
    monthlyTotal: subs.reduce((sum, sub) => sum + monthlyEquivalent(sub.amount, sub.cycle), 0),
    activeCount: subs.length,
    increases: moves.filter((move) => move.kind === "increase"),
    decreases: moves.filter((move) => move.kind === "decrease"),
    newSubscriptions: (created.data ?? []).map((sub) => ({
      provider: sub.provider,
      amount: sub.amount,
      cycle: sub.cycle,
    })),
    cancelled: (cancelled.data ?? []).map((sub) => ({
      provider: sub.provider,
      monthly: monthlyEquivalent(sub.amount, sub.cycle),
    })),
    upcoming: subs
      .filter((sub) => sub.next_renewal && sub.next_renewal >= today && sub.next_renewal <= in30)
      .sort((a, b) => a.next_renewal!.localeCompare(b.next_renewal!))
      .slice(0, 6)
      .map((sub) => ({ provider: sub.provider, date: sub.next_renewal!, amount: sub.amount })),
    documentsAdded: documents.count ?? 0,
  };
}

/** Rien à raconter : pas d'abonnement suivi, pas de document. */
export function isEmptyRecap(data: RecapData): boolean {
  return data.activeCount === 0 && data.documentsAdded === 0 && data.cancelled.length === 0;
}

function section(title: string, rows: string[]): string {
  if (rows.length === 0) return "";
  return `<h2 style="margin:24px 0 8px;font-size:15px;font-weight:700">${escapeHtml(title)}</h2>
    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">${rows.join("")}</table>`;
}

function row(left: string, right: string, color = "#1a1a2e"): string {
  return `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${escapeHtml(left)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;color:${color};white-space:nowrap">${escapeHtml(right)}</td></tr>`;
}

export function renderRecapEmail(
  data: RecapData,
  input: { name: string | null; siteUrl: string },
): AlertEmail {
  const date = (iso: string) =>
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(`${iso}T00:00:00Z`));
  const yearlyIncrease = data.increases.reduce((sum, move) => sum + move.yearly, 0);

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f5f5fa;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a2e">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
    <p style="margin:0 0 8px;font-size:13px;color:#6b6b80">Ton récap de ${escapeHtml(data.monthLabel)}</p>
    <h1 style="margin:0 0 4px;font-size:26px;font-weight:700">${euros(data.monthlyTotal)} <span style="font-size:15px;font-weight:400;color:#6b6b80">par mois</span></h1>
    <p style="margin:0;font-size:14px;color:#6b6b80">${data.activeCount} abonnement${data.activeCount > 1 ? "s" : ""} suivi${data.activeCount > 1 ? "s" : ""}${data.documentsAdded ? ` · ${data.documentsAdded} document${data.documentsAdded > 1 ? "s" : ""} classé${data.documentsAdded > 1 ? "s" : ""} en ${escapeHtml(data.monthLabel.split(" ")[0])}` : ""}</p>
    ${section(
      yearlyIncrease > 0 ? `Hausses de prix · +${euros(yearlyIncrease)} par an` : "Hausses de prix",
      data.increases.map((move) => row(`${move.provider} : ${euros(move.oldAmount)} → ${euros(move.newAmount)}`, `+${euros(move.yearly)}/an`, "#b45309")),
    )}
    ${section(
      "Baisses de prix",
      data.decreases.map((move) => row(`${move.provider} : ${euros(move.oldAmount)} → ${euros(move.newAmount)}`, `${euros(move.yearly)}/an`, "#047857")),
    )}
    ${section(
      "Nouveaux abonnements détectés",
      data.newSubscriptions.map((sub) => row(sub.provider, sub.amount !== null ? euros(sub.amount) : "montant inconnu")),
    )}
    ${section(
      "Résiliations confirmées",
      data.cancelled.map((sub) => row(sub.provider, sub.monthly ? `−${euros(sub.monthly)}/mois` : "résilié", "#047857")),
    )}
    ${section(
      "À venir dans les 30 jours",
      data.upcoming.map((sub) => row(`${sub.provider} · ${date(sub.date)}`, sub.amount !== null ? euros(sub.amount) : "")),
    )}
    <p style="margin:28px 0 0">
      <a href="${input.siteUrl}/dashboard" style="display:inline-block;background:#6c5ce7;color:#fff;text-decoration:none;padding:11px 20px;border-radius:7px;font-size:14px;font-weight:600">Ouvrir mon tableau de bord</a>
    </p>
    <p style="margin:24px 0 0;font-size:12px;color:#8c8ca0">Tu reçois ce récap parce que tu es abonné à AdminPilot. <a href="${input.siteUrl}/reglages#recap" style="color:#8c8ca0">Ne plus le recevoir</a>.</p>
  </div>
</body></html>`;

  const lines = [
    `Ton récap de ${data.monthLabel}`,
    `${euros(data.monthlyTotal)} par mois · ${data.activeCount} abonnement(s)`,
    ...data.increases.map((m) => `Hausse : ${m.provider} ${euros(m.oldAmount)} → ${euros(m.newAmount)} (+${euros(m.yearly)}/an)`),
    ...data.decreases.map((m) => `Baisse : ${m.provider} ${euros(m.oldAmount)} → ${euros(m.newAmount)}`),
    ...data.newSubscriptions.map((s) => `Nouveau : ${s.provider}`),
    ...data.cancelled.map((s) => `Résilié : ${s.provider}`),
    ...data.upcoming.map((s) => `À venir : ${s.provider} le ${date(s.date)}`),
    "",
    `${input.siteUrl}/dashboard`,
    `Ne plus recevoir ce récap : ${input.siteUrl}/reglages#recap`,
  ];

  return {
    subject: `Ton récap AdminPilot de ${data.monthLabel}`,
    html,
    text: lines.join("\n"),
  };
}

/** Comptes traités par passage : la tâche reprend les suivants le lendemain. */
const BATCH = 100;

/**
 * Envoi des récapitulatifs du mois écoulé, du 1er au 3 du mois.
 *
 * Chaque compte est « réservé » en posant la période avant l'envoi, par une
 * mise à jour conditionnelle : deux exécutions simultanées ne peuvent pas
 * envoyer deux fois le même récapitulatif.
 */
export async function sendMonthlyRecaps(input: {
  db: Db;
  resend: Resend;
  from: string;
  siteUrl: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const result = { candidates: 0, sent: 0, empty: 0, failed: 0 };
  if (now.getUTCDate() > 3) return result;

  const { period } = recapPeriod(now);
  const { data: profiles, error } = await input.db
    .from("profiles")
    .select("id, email, name")
    .neq("plan", "free")
    .eq("monthly_recap", true)
    .is("deleted_at", null)
    .or(`last_recap_period.is.null,last_recap_period.neq.${period}`)
    .limit(BATCH);
  if (error) throw error;

  for (const profile of profiles ?? []) {
    result.candidates += 1;

    const { data: claimed } = await input.db
      .from("profiles")
      .update({ last_recap_period: period })
      .eq("id", profile.id)
      .or(`last_recap_period.is.null,last_recap_period.neq.${period}`)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      const data = await buildRecap(input.db, profile.id, now);
      if (isEmptyRecap(data)) {
        result.empty += 1;
        continue;
      }
      const email = renderRecapEmail(data, { name: profile.name, siteUrl: input.siteUrl });
      const { error: sendError } = await input.resend.emails.send({
        from: input.from,
        to: profile.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      if (sendError) throw new Error(sendError.message);
      result.sent += 1;
    } catch {
      // Aucun détail journalisé : le message d'erreur contient l'adresse.
      result.failed += 1;
    }
  }

  return result;
}
