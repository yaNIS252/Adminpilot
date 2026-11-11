import "server-only";

import { unlockHiddenSubscriptions } from "@/lib/billing/sync";
import { TRIAL_DAYS } from "@/lib/constants";
import { syncBonusLine } from "@/lib/referral/bonus-line";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Essai Pro de 14 jours, sans carte bancaire, à la première connexion.
 *
 * Même mécanique que le mois offert par parrainage (`bonus_pro_until`) : Pro
 * tout de suite, ligne « AdminPilot Pro (offert) » avec ses rappels de fin,
 * retour en gratuit tout seul. Un mois de parrainage s'ajoute à la suite.
 *
 * Une seule fois par compte, jamais pour un ancien client (compte Stripe) ni
 * pour un membre d'un foyer. Ne lève pas : un essai manqué ne doit jamais
 * empêcher la connexion.
 */
export async function startTrialIfNew(db: Db, userId: string): Promise<boolean> {
  try {
    const until = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
    // Conditions dans la requête elle-même : deux connexions simultanées ne
    // peuvent pas accorder deux essais.
    const { data: started } = await db
      .from("profiles")
      .update({
        plan: "pro",
        bonus_pro_until: until.toISOString(),
        trial_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .eq("plan", "free")
      .is("trial_started_at", null)
      .is("stripe_customer_id", null)
      .is("bonus_pro_until", null)
      .is("deleted_at", null)
      .select("id");
    if (!started?.length) return false;

    await unlockHiddenSubscriptions(db, userId);
    await syncBonusLine(db, userId, until);
    return true;
  } catch (error) {
    console.error("[essai] démarrage impossible:", error);
    return false;
  }
}
