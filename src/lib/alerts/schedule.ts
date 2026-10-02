import "server-only";

import { ALERT_OFFSETS_DAYS } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Programmation automatique des alertes d'échéance.
 *
 * Appelée dès qu'un abonnement ou un document daté est créé. La `dedup_key`
 * porte la date d'échéance : si celle-ci change, de nouvelles alertes sont
 * créées, et si la même échéance est revue deux fois, rien n'est dupliqué.
 * C'est la base qui garantit l'unicité, pas le code appelant.
 */

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBefore(deadline: string, days: number): Date {
  const date = new Date(`${deadline}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

export async function scheduleDeadlineAlerts(input: {
  userId: string;
  refType: "subscription" | "document";
  refId: string;
  deadline: string;
  title: string;
  message: string;
}): Promise<number> {
  const db = createAdminClient();
  const today = formatDate(new Date());

  // Rappels coupés par l'utilisateur pour cet abonnement : on n'en programme
  // plus, d'où que vienne la demande (pipeline, déblocage, correction).
  if (input.refType === "subscription") {
    const { data: sub } = await db
      .from("subscriptions")
      .select("reminders_muted")
      .eq("id", input.refId)
      .maybeSingle();
    if (sub?.reminders_muted) return 0;
  }

  const rows = ALERT_OFFSETS_DAYS.map((offset) => ({
    user_id: input.userId,
    ref_type: input.refType,
    ref_id: input.refId,
    title: input.title,
    message: input.message,
    alert_date: formatDate(daysBefore(input.deadline, offset)),
    dedup_key: `${input.refType}:${input.refId}:${input.deadline}:j-${offset}`,
  }))
    // Une échéance dans 3 jours ne doit pas produire une alerte « J-7 » datée
    // dans le passé, qui partirait immédiatement et à contretemps.
    .filter((row) => row.alert_date >= today);

  if (!rows.length) return 0;

  const { error } = await db
    .from("alerts")
    .upsert(rows, { onConflict: "dedup_key", ignoreDuplicates: true });

  if (error) throw error;
  return rows.length;
}
