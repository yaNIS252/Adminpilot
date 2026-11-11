import "server-only";

import webpush from "web-push";

import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Notifications du navigateur, en plus des e-mails (formule Premium).
 *
 * Sans les clés VAPID, tout est sans effet : la fonction reste éteinte tant
 * qu'elle n'est pas configurée. Un abonnement refusé par le navigateur
 * (désinstallé, permission retirée) est supprimé.
 */

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let ready = false;
function setup() {
  if (ready) return;
  webpush.setVapidDetails(
    `mailto:${process.env.SUPPORT_FORWARD_TO?.trim() || "bonjour@in.zylax.fr"}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  ready = true;
}

/** Envoie une notification à tous les appareils du compte. Ne lève pas. */
export async function sendPush(
  db: Db,
  userId: string,
  message: { title: string; body: string; url: string },
): Promise<number> {
  if (!pushConfigured()) return 0;
  try {
    setup();
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    let sent = 0;
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: message.title.slice(0, 120),
            body: message.body.slice(0, 300),
            url: message.url,
          }),
          { TTL: 86_400 },
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404 / 410 : l'appareil n'existe plus côté navigateur.
        if (status === 404 || status === 410) {
          await db.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
    return sent;
  } catch (error) {
    console.error("[push]", error instanceof Error ? error.message : error);
    return 0;
  }
}
