import "server-only";

import { scheduleDeadlineAlerts } from "@/lib/alerts/schedule";
import { OWN_SUBSCRIPTION_SOURCE } from "@/lib/billing/sync";
import { PLAN_LIMITS, PLAN_PRICES } from "@/lib/constants";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/** Rappels avant la fin du mois offert : une semaine, puis la veille. */
const BONUS_REMINDER_DAYS = [7, 1] as const;

function frenchDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

/**
 * Ligne « AdminPilot Pro (offert) » dans les abonnements suivis, pendant un
 * mois de Pro offert par parrainage, avec ses rappels de fin.
 *
 * Même principe que l'abonnement payant : l'outil qui suit tes abonnements
 * affiche le sien. C'est la même ligne (une seule par compte, migration
 * 0022) : si l'utilisateur s'abonne, Stripe la reprend telle quelle.
 */
export async function syncBonusLine(db: Db, userId: string, until: Date) {
  const end = until.toISOString().slice(0, 10);
  const row = {
    provider: "AdminPilot Pro (offert)",
    amount: 0,
    currency: "EUR",
    cycle: "monthly" as const,
    category: "logiciel",
    next_renewal: end,
    status: "active" as const,
    cancelled_at: null,
    confidence: 1,
    confirmed_by_user: true,
    over_quota: false,
    metadata: { source: OWN_SUBSCRIPTION_SOURCE, bonus: true },
  };

  const { data: existing } = await db
    .from("subscriptions")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("metadata->>source", OWN_SUBSCRIPTION_SOURCE)
    .maybeSingle();

  // Une ligne d'abonnement payant existe déjà : on n'y touche pas.
  if (existing && !(existing.metadata as { bonus?: boolean } | null)?.bonus) return;

  let id = existing?.id ?? null;
  if (id) {
    await db.from("subscriptions").update(row).eq("id", id);
  } else {
    const { data } = await db
      .from("subscriptions")
      .insert({ ...row, user_id: userId })
      .select("id")
      .single();
    id = data?.id ?? null;
  }
  if (!id) return;

  await db
    .from("alerts")
    .delete()
    .eq("user_id", userId)
    .eq("ref_id", id)
    .eq("kind", "deadline")
    .is("sent_at", null);

  const free = PLAN_LIMITS.free;
  const price = PLAN_PRICES.pro.monthly.toFixed(2).replace(".", ",");
  await scheduleDeadlineAlerts({
    userId,
    refType: "subscription",
    refId: id,
    deadline: end,
    title: "Ton mois de Pro offert se termine",
    message: `Le ${frenchDate(end)}, ton compte repassera en formule gratuite : ${free.subscriptions} abonnements suivis, ${free.documents} documents, ${free.alerts} alertes par mois. Pour tout garder, passe à Pro (${price} € par mois) : rien ne sera prélevé avant la fin de ton mois offert.`,
    offsets: BONUS_REMINDER_DAYS,
  });
}

/** Fin du mois offert sans abonnement : la ligne gratuite disparaît. */
export async function removeBonusLine(db: Db, userId: string) {
  const { data: line } = await db
    .from("subscriptions")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("metadata->>source", OWN_SUBSCRIPTION_SOURCE)
    .maybeSingle();
  if (!line || !(line.metadata as { bonus?: boolean } | null)?.bonus) return;
  await db.from("alerts").delete().eq("ref_id", line.id).is("sent_at", null);
  await db.from("subscriptions").delete().eq("id", line.id);
}
