import "server-only";

import { activeTrialUntil, formatAmount } from "@/lib/format";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Agenda iCal des échéances : renouvellements (récurrents, au rythme de
 * l'abonnement), fins d'essai, fins d'engagement et dates limites des
 * documents. Google Agenda, Apple Calendrier et Outlook s'y abonnent par
 * lien et le relisent seuls (Google : toutes les 12 à 24 heures).
 *
 * Un événement par échéance, sur la journée, avec un rappel la veille à 9 h :
 * pas un événement par rappel, l'agenda gère lui-même les notifications.
 */

const RRULE: Record<string, string> = {
  weekly: "FREQ=WEEKLY",
  monthly: "FREQ=MONTHLY",
  quarterly: "FREQ=MONTHLY;INTERVAL=3",
  yearly: "FREQ=YEARLY",
};

/** Échappement des valeurs texte (RFC 5545, 3.3.11). */
function text(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lignes de plus de 75 octets repliées (RFC 5545, 3.1). */
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, "utf8") > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut), "utf8") > 74) cut -= 1;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  parts.push(rest);
  return parts.join("\r\n ");
}

function day(date: string): string {
  return date.slice(0, 10).replace(/-/g, "");
}

function nextDay(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

type CalendarEvent = {
  uid: string;
  date: string;
  summary: string;
  description?: string;
  rrule?: string;
};

function render(events: CalendarEvent[], stamp: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AdminPilot//Echeances//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:AdminPilot",
    "X-WR-TIMEZONE:Europe/Paris",
    "X-PUBLISHED-TTL:PT12H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}@adminpilot`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day(event.date)}`,
      `DTEND;VALUE=DATE:${nextDay(event.date)}`,
      `SUMMARY:${text(event.summary)}`,
      ...(event.description ? [`DESCRIPTION:${text(event.description)}`] : []),
      ...(event.rrule ? [`RRULE:${event.rrule}`] : []),
      "TRANSP:TRANSPARENT",
      // La veille à 9 h (l'événement commence à minuit).
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${text(event.summary)}`,
      "TRIGGER:-PT15H",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export async function buildCalendar(db: Db, userId: string, siteUrl: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: subs }, { data: docs }] = await Promise.all([
    db
      .from("subscriptions")
      .select("id, provider, amount, currency, cycle, next_renewal, reminders_muted, metadata")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("over_quota", false),
    db
      .from("documents")
      .select("id, filename_ai, filename_original, deadline")
      .eq("user_id", userId)
      .gte("deadline", today),
  ]);

  const events: CalendarEvent[] = [];
  for (const sub of subs ?? []) {
    if (sub.reminders_muted) continue;
    const meta = (sub.metadata ?? {}) as Record<string, unknown>;
    const price = formatAmount(sub.amount, sub.currency);
    const link = `${siteUrl}/abonnements/${sub.id}`;

    const trialUntil = activeTrialUntil(sub.metadata);
    if (trialUntil) {
      events.push({
        uid: `${sub.id}-essai`,
        date: trialUntil,
        summary: `Fin de l'essai ${sub.provider}`,
        description: `${price ? `Premier prélèvement : ${price}. ` : ""}Pour ne pas payer, résilie avant : ${link}`,
      });
    }
    if (sub.next_renewal && sub.next_renewal !== trialUntil) {
      events.push({
        uid: `${sub.id}-renouvellement`,
        date: sub.next_renewal,
        summary: `${sub.provider} se renouvelle${price ? ` (${price})` : ""}`,
        description: `Détails et résiliation : ${link}`,
        rrule: RRULE[sub.cycle],
      });
    }
    const commitmentEnd = typeof meta.commitment_end === "string" ? meta.commitment_end : null;
    if (commitmentEnd && commitmentEnd >= today) {
      events.push({
        uid: `${sub.id}-engagement`,
        date: commitmentEnd,
        summary: `Fin d'engagement ${sub.provider}`,
        description: `Tu peux résilier sans frais à partir de cette date : ${link}`,
      });
    }
  }
  for (const doc of docs ?? []) {
    if (!doc.deadline) continue;
    events.push({
      uid: `${doc.id}-document`,
      date: doc.deadline,
      summary: `Échéance : ${doc.filename_ai ?? doc.filename_original}`,
      description: `${siteUrl}/documents`,
    });
  }

  const stamp = `${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  return render(events, stamp);
}
