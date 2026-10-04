import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/supabase/types";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Vrai si le plan Pro du compte est un mois offert par le parrainage, et non
 * un abonnement payé. Invariant : `bonus_pro_until` est effacé dès qu'un
 * abonnement Stripe ouvre les droits, si bien qu'une date future signifie
 * toujours « Pro sans paiement ».
 */
export function bonusActive(
  profile: Pick<Profile, "plan" | "bonus_pro_until">,
  now = new Date(),
): boolean {
  return (
    profile.plan === "pro" &&
    Boolean(profile.bonus_pro_until && new Date(profile.bonus_pro_until) > now)
  );
}

/**
 * Remet en Pro les comptes qui viennent de retomber en gratuit (fin d'un
 * abonnement, sortie d'un foyer) alors qu'un mois offert court encore : on ne
 * reprend pas un cadeau parce qu'un autre avantage s'arrête.
 */
export async function restoreBonus(db: Db, userIds: string[]) {
  if (userIds.length === 0) return;
  const { error } = await db
    .from("profiles")
    .update({ plan: "pro", updated_at: new Date().toISOString() })
    .in("id", userIds)
    .eq("plan", "free")
    .gt("bonus_pro_until", new Date().toISOString());
  if (error) throw error;
}
