import "server-only";

import { PLAN_LIMITS } from "@/lib/constants";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

const OWN_SOURCE = "adminpilot_billing";

/**
 * Retour en formule gratuite (fin d'essai, fin du mois offert, résiliation,
 * sortie d'un foyer) : seuls les premiers abonnements détectés restent
 * visibles, les autres sont remis en réserve et leurs rappels retirés.
 *
 * Sans cela, la limite gratuite ne tenait que pour qui n'avait jamais eu de
 * formule payante : un mois d'essai suffisait à tout garder pour toujours.
 * Rien n'est supprimé : repasser Pro réaffiche tout, rappels compris.
 *
 * Sans effet si le compte n'est pas (ou plus) en gratuit.
 */
export async function enforceFreeLimits(db: Db, userId: string): Promise<number> {
  const { data: profile } = await db.from("profiles").select("plan").eq("id", userId).maybeSingle();
  if (profile?.plan !== "free") return 0;
  const limit = PLAN_LIMITS.free.subscriptions;
  if (limit === null) return 0;

  const { data: subs, error } = await db
    .from("subscriptions")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("over_quota", false)
    .order("detected_at", { ascending: true });
  if (error) throw error;

  const hidden = (subs ?? [])
    .filter((sub) => (sub.metadata as { source?: string } | null)?.source !== OWN_SOURCE)
    .slice(limit)
    .map((sub) => sub.id);
  if (hidden.length === 0) return 0;

  await db.from("subscriptions").update({ over_quota: true }).in("id", hidden);
  await db
    .from("alerts")
    .delete()
    .eq("user_id", userId)
    .eq("ref_type", "subscription")
    .in("ref_id", hidden)
    .is("sent_at", null);
  return hidden.length;
}
