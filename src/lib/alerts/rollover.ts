import "server-only";

import { scheduleDeadlineAlerts } from "@/lib/alerts/schedule";
import { getNextRenewal } from "@/lib/ingest/schedule";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/** Même seuil que l'analyse : sous lui, une échéance n'a pas d'alerte. */
const REVIEW_THRESHOLD = 0.7;

/**
 * Échéances passées : avancées à la prochaine, alertes J-7 et J-1 recréées.
 *
 * Sans cette tâche, une fois la date de renouvellement dépassée, le compte à
 * rebours restait bloqué et plus aucun rappel ne partait jusqu'à la facture
 * suivante. Une nouvelle facture reçue entre-temps prime : c'est elle qui
 * fixe la date, cette tâche ne fait que combler les mois sans e-mail.
 *
 * Les doublons d'alertes sont exclus par la base (`dedup_key` unique).
 */
export async function rollRenewals(db: Db, now = new Date()): Promise<{ rolled: number }> {
  const today = now.toISOString().slice(0, 10);
  const { data, error } = await db
    .from("subscriptions")
    .select("id, user_id, provider, cycle, next_renewal, confidence, confirmed_by_user, metadata")
    .eq("status", "active")
    .eq("over_quota", false)
    .lt("next_renewal", today)
    .in("cycle", ["monthly", "quarterly", "yearly", "weekly"])
    .limit(500);
  if (error) throw error;

  let rolled = 0;
  for (const sub of data ?? []) {
    const next = getNextRenewal(sub.next_renewal, sub.cycle, now);
    if (!next || next === sub.next_renewal) continue;

    // Essai terminé : l'abonnement est désormais payant, plus « en essai ».
    const meta = (sub.metadata ?? {}) as Record<string, unknown>;
    const trialOver = typeof meta.trial_until === "string" && meta.trial_until < today;
    const metadata = { ...meta };
    if (trialOver) delete metadata.trial_until;

    const { error: updateError } = await db
      .from("subscriptions")
      .update({ next_renewal: next, ...(trialOver ? { metadata: metadata as never } : {}) })
      .eq("id", sub.id)
      // Garde-fou : une facture arrivée pendant le calcul a la priorité.
      .eq("next_renewal", sub.next_renewal as string);
    if (updateError) {
      console.error("[cron] échéance:", updateError.message);
      continue;
    }
    rolled += 1;

    if (sub.confirmed_by_user || sub.confidence >= REVIEW_THRESHOLD) {
      await scheduleDeadlineAlerts({
        userId: sub.user_id,
        refType: "subscription",
        refId: sub.id,
        deadline: next,
        title: `${sub.provider} se renouvelle`,
        message: `Prochaine échéance le ${next}.`,
      }).catch((scheduleError) => console.error("[cron] alertes échéance:", scheduleError));
    }
  }
  return { rolled };
}
