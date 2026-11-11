import "server-only";

import type { Resend } from "resend";

import { escapeHtml } from "@/lib/alerts/email";
import { incrementUsage } from "@/lib/billing/quotas";
import { PLAN_LIMITS } from "@/lib/constants";
import { formatAmount, formatCycle } from "@/lib/format";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Nouvel abonnement détecté : pastille dans l'application, puis un seul
 * e-mail récapitulatif par jour (« Nouvel abonnement détecté : Spotify,
 * 10,99 €/mois », ou la liste s'il y en a plusieurs).
 *
 * Pas pendant la mise en place : l'import de l'historique ou les premiers
 * e-mails reçus pendant la présentation feraient arriver une rafale de
 * notifications pour des abonnements que l'utilisateur connaît déjà ; le
 * tableau de bord en fait le récapitulatif.
 */
export async function recordNewSubscription(
  db: Db,
  input: {
    userId: string;
    subscriptionId: string;
    provider: string;
    amount: number | null;
    currency: string;
    cycle: string;
  },
): Promise<void> {
  const { data: profile } = await db
    .from("profiles")
    .select("tour_completed_at, notify_new_subscription, deleted_at")
    .eq("id", input.userId)
    .maybeSingle();
  if (!profile || profile.deleted_at || !profile.tour_completed_at || !profile.notify_new_subscription) {
    return;
  }

  const price = formatAmount(input.amount, input.currency);
  const cycle = formatCycle(input.cycle);
  const { error } = await db.from("alerts").upsert(
    {
      user_id: input.userId,
      ref_type: "subscription",
      ref_id: input.subscriptionId,
      kind: "new_subscription",
      title: `Nouvel abonnement détecté : ${input.provider}`,
      message: price ? `${price}${cycle ? ` ${cycle}` : ""}` : "Montant à confirmer",
      alert_date: new Date().toISOString().slice(0, 10),
      dedup_key: `subscription:${input.subscriptionId}:new`,
    },
    { onConflict: "dedup_key", ignoreDuplicates: true },
  );
  if (error) console.error("[alertes] nouvel abonnement:", error.message);
}

/**
 * Envoi du jour : les nouveaux abonnements de chaque utilisateur, en un seul
 * e-mail. En formule gratuite, ce récapitulatif compte pour une alerte du
 * mois ; au-delà du quota, la pastille dans l'application reste visible.
 */
export async function sendNewSubscriptionDigests(input: {
  db: Db;
  resend: Resend;
  from: string;
  siteUrl: string;
  sentThisMonth: (userId: string) => Promise<number>;
}): Promise<{ sent: number; capped: number }> {
  const { db } = input;
  const today = new Date().toISOString().slice(0, 10);
  const { data: alerts, error } = await db
    .from("alerts")
    .select("id, user_id, title, message, profiles!inner(email, plan, deleted_at)")
    .eq("kind", "new_subscription")
    .is("sent_at", null)
    .lte("alert_date", today)
    .limit(500);
  if (error) throw error;

  const byUser = new Map<string, NonNullable<typeof alerts>>();
  for (const alert of alerts ?? []) {
    byUser.set(alert.user_id, [...(byUser.get(alert.user_id) ?? []), alert]);
  }

  let sent = 0;
  let capped = 0;
  for (const [userId, items] of byUser) {
    // Clôturées avant l'envoi : jamais deux fois le même récapitulatif.
    await db
      .from("alerts")
      .update({ sent_at: new Date().toISOString() })
      .in(
        "id",
        items.map((item) => item.id),
      );

    const profile = items[0].profiles as unknown as {
      email: string;
      plan: keyof typeof PLAN_LIMITS;
      deleted_at: string | null;
    };
    if (profile.deleted_at) continue;
    const limit = PLAN_LIMITS[profile.plan]?.alerts ?? null;
    if (limit !== null && (await input.sentThisMonth(userId)) >= limit) {
      capped += 1;
      continue;
    }

    const lines = items.map((item) => `${item.title.replace(/^Nouvel abonnement détecté : /, "")}, ${item.message}`);
    const subject =
      items.length === 1
        ? `${items[0].title}, ${items[0].message}`
        : `${items.length} nouveaux abonnements détectés`;
    const url = `${input.siteUrl}/abonnements`;

    try {
      const { error: sendError } = await input.resend.emails.send({
        from: input.from,
        to: profile.email,
        subject,
        text: `${items.length === 1 ? "Nouvel abonnement détecté" : "Nouveaux abonnements détectés"} :\n\n${lines.map((line) => `· ${line}`).join("\n")}\n\nLes voir : ${url}`,
        html: `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f5f5fa;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a2e">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
    <p style="margin:0 0 8px;font-size:13px;color:#6b6b80">Nouveau</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700">${items.length === 1 ? "Nouvel abonnement détecté" : `${items.length} nouveaux abonnements détectés`}</h1>
    <ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.7">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
    <p style="margin:16px 0 0;font-size:14px;color:#6b6b80">Ce n’est pas toi ? Vérifie-le avant le prochain prélèvement.</p>
    <p style="margin:24px 0 0"><a href="${url}" style="display:inline-block;background:#6c5ce7;color:#fff;text-decoration:none;padding:11px 20px;border-radius:7px;font-size:14px;font-weight:600">Voir mes abonnements</a></p>
    <p style="margin:20px 0 0;font-size:12px;color:#6b6b80">Ces e-mails se désactivent dans Réglages → Notifications.</p>
  </div>
</body></html>`,
      });
      if (!sendError) {
        sent += 1;
        await incrementUsage(userId, "alerts").catch(() => {});
      }
    } catch (sendError) {
      console.error("[cron] nouveaux abonnements:", sendError);
    }
  }
  return { sent, capped };
}
