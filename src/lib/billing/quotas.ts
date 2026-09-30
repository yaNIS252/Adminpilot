import "server-only";

import { PLAN_LIMITS, type Feature } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";

/**
 * Compteurs d'usage mensuels.
 *
 * Deux familles de features cohabitent, et les confondre serait un bug :
 *  · les cumulatifs (`subscriptions`, `documents`) comptent le stock réel en
 *    base — supprimer un document doit libérer une place ;
 *  · les périodiques (`alerts`, `searches`, `cancellations`) comptent les actes
 *    du mois en cours et se réinitialisent le 1er.
 */

const STOCK_FEATURES = {
  subscriptions: "subscriptions",
  documents: "documents",
} as const satisfies Partial<Record<Feature, string>>;

type StockFeature = keyof typeof STOCK_FEATURES;

function isStockFeature(feature: Feature): feature is StockFeature {
  return feature in STOCK_FEATURES;
}

/** Période courante au format `YYYY-MM`. */
export function currentPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type LimitCheck = {
  allowed: boolean;
  current: number;
  /** `null` = illimité. */
  max: number | null;
};

export async function checkLimit(
  userId: string,
  plan: Enums<"plan">,
  feature: Feature,
): Promise<LimitCheck> {
  const max = PLAN_LIMITS[plan][feature];
  if (max === null) return { allowed: true, current: 0, max: null };

  const db = createAdminClient();
  let current = 0;

  if (isStockFeature(feature)) {
    // Stock réel : ce qui existe aujourd'hui, pas ce qui a été créé un jour.
    const table = feature === "subscriptions" ? "subscriptions" : "documents";
    const { count, error } = await db
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) throw error;
    current = count ?? 0;

    // Documents envoyés mais pas encore analysés : sans eux, un compte
    // gratuit pouvait déposer bien plus que sa limite avant le premier
    // passage du traitement, et chacun devenait ensuite un document.
    if (feature === "documents") {
      const { count: waiting, error: waitingError } = await db
        .from("ingestion_jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("source", "upload")
        .in("status", ["pending", "processing"]);
      if (waitingError) throw waitingError;
      current += waiting ?? 0;
    }
  } else {
    const { data, error } = await db
      .from("usage_counters")
      .select("alerts_count, searches_count, cancellations_count")
      .eq("user_id", userId)
      .eq("period", currentPeriod())
      .maybeSingle();

    if (error) throw error;
    current =
      feature === "alerts"
        ? (data?.alerts_count ?? 0)
        : feature === "searches"
          ? (data?.searches_count ?? 0)
          : (data?.cancellations_count ?? 0);
  }

  return { allowed: current < max, current, max };
}

const COUNTER_COLUMNS = {
  alerts: "alerts_count",
  searches: "searches_count",
  cancellations: "cancellations_count",
} as const;

/**
 * Incrémente un compteur périodique.
 *
 * Passe par une fonction Postgres plutôt que lire-puis-écrire : deux requêtes
 * concurrentes du même utilisateur pourraient sinon consommer un seul quota.
 */
export async function incrementUsage(
  userId: string,
  feature: keyof typeof COUNTER_COLUMNS,
): Promise<void> {
  const db = createAdminClient();

  const { error } = await db.rpc("increment_usage", {
    p_user_id: userId,
    p_period: currentPeriod(),
    p_column: COUNTER_COLUMNS[feature],
  });

  if (error) throw error;
}
