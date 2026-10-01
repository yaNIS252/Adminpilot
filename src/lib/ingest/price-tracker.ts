import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Surveillance des prix.
 *
 * Appelée pour chaque e-mail d'un abonnement déjà connu. Deux cas :
 *  · facture : le montant facturé diffère du précédent ;
 *  · annonce : le fournisseur prévient d'un nouveau tarif à venir — l'alerte
 *    arrive alors avant le premier prélèvement plus cher, quand il est encore
 *    temps de résilier.
 *
 * Une hausse déclenche une alerte ; une baisse est seulement enregistrée et
 * affichée, une bonne nouvelle n'a pas à réveiller qui que ce soit.
 */

/**
 * Catégories facturées à la consommation : leur montant varie d'une facture
 * à l'autre sans que le prix change. Seule une annonce explicite de nouveau
 * tarif y vaut changement de prix.
 */
const METERED_CATEGORIES = new Set(["energie"]);

/**
 * Écart au-delà duquel on soupçonne une erreur de lecture plutôt qu'un vrai
 * changement de prix (un total annuel lu comme un mensuel, par exemple).
 */
const MAX_RATIO = 3;

/** Une annonce suivie de la première facture au nouveau prix : un seul changement. */
const ANNOUNCEMENT_WINDOW_DAYS = 180;

export type TrackedSubscription = {
  id: string;
  provider: string;
  amount: number | null;
  cycle: Enums<"billing_cycle">;
  category: string | null;
  over_quota: boolean;
};

export type PriceChangeResult =
  | { recorded: false; reason: string }
  | { recorded: true; kind: "increase" | "decrease"; id: string; alerted: boolean };

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function formatEuros(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

/** Nombre de prélèvements par an, pour chiffrer l'impact annuel. */
export function periodsPerYear(cycle: string): number {
  return { monthly: 12, yearly: 1, quarterly: 4, weekly: 52 }[cycle] ?? 0;
}

export async function trackPriceChange(
  db: Db,
  input: {
    userId: string;
    subscription: TrackedSubscription;
    newAmount: number | null;
    currency: string;
    /** Périodicité lue sur la facture ; `unknown` vaut « la même ». */
    cycle: Enums<"billing_cycle">;
    source: "invoice" | "announcement";
    previousAmount?: number | null;
    effectiveDate?: string | null;
  },
): Promise<PriceChangeResult> {
  const sub = input.subscription;
  const oldAmount =
    input.source === "announcement"
      ? (input.previousAmount ?? sub.amount)
      : sub.amount;

  if (oldAmount === null || input.newAmount === null || oldAmount <= 0) {
    return { recorded: false, reason: "montant inconnu" };
  }

  // Comparer un mensuel à un annuel n'a pas de sens : c'est un changement de
  // formule, pas de prix.
  if (sub.cycle === "unknown" || sub.cycle === "one_time") {
    return { recorded: false, reason: "périodicité inconnue" };
  }
  if (input.source === "invoice" && input.cycle !== "unknown" && input.cycle !== sub.cycle) {
    return { recorded: false, reason: "périodicité différente" };
  }

  if (input.source === "invoice" && sub.category && METERED_CATEGORIES.has(sub.category)) {
    return { recorded: false, reason: "facturation à la consommation" };
  }

  const newAmount = round2(input.newAmount);
  const previous = round2(oldAmount);
  const diff = round2(newAmount - previous);
  if (Math.abs(diff) < 0.01) return { recorded: false, reason: "prix inchangé" };

  const ratio = newAmount / previous;
  if (ratio > MAX_RATIO || ratio < 1 / MAX_RATIO) {
    return { recorded: false, reason: "écart invraisemblable" };
  }

  // Le nouveau prix devient le prix connu dès qu'une facture le constate,
  // même sur une ligne confirmée à la main : c'est une information neuve, pas
  // une correction. Une annonce, elle, ne change rien avant sa date d'effet.
  if (input.source === "invoice") {
    await db.from("subscriptions").update({ amount: newAmount }).eq("id", sub.id);

    const since = new Date(Date.now() - ANNOUNCEMENT_WINDOW_DAYS * 86_400_000).toISOString();
    const { count } = await db
      .from("price_changes")
      .select("id", { count: "exact", head: true })
      .eq("subscription_id", sub.id)
      .eq("source", "announcement")
      .eq("new_amount", newAmount)
      .gte("created_at", since);
    if (count) return { recorded: false, reason: "déjà annoncé" };
  }

  const kind = diff > 0 ? "increase" : "decrease";
  const dedupKey =
    input.source === "announcement"
      ? `${sub.id}:annonce:${newAmount}:${input.effectiveDate ?? "?"}`
      : `${sub.id}:${previous}->${newAmount}`;

  const { data: change, error } = await db
    .from("price_changes")
    .upsert(
      {
        user_id: input.userId,
        subscription_id: sub.id,
        old_amount: previous,
        new_amount: newAmount,
        currency: input.currency || "EUR",
        cycle: sub.cycle,
        kind,
        source: input.source,
        effective_date: input.effectiveDate ?? null,
        dedup_key: dedupKey,
      },
      { onConflict: "dedup_key", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!change) return { recorded: false, reason: "déjà enregistré" };

  // Pas d'alerte sur un abonnement masqué par la limite gratuite : la même
  // règle que pour les rappels d'échéance.
  const alerted = kind === "increase" && !sub.over_quota;
  if (alerted) {
    const yearly = round2(diff * periodsPerYear(sub.cycle));
    const when = input.effectiveDate
      ? ` à partir du ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(`${input.effectiveDate}T00:00:00Z`))}`
      : "";
    await db.from("alerts").upsert(
      {
        user_id: input.userId,
        ref_type: "subscription",
        ref_id: sub.id,
        kind: "price_change",
        price_change_id: change.id,
        title: `${sub.provider} augmente`,
        message: `${formatEuros(previous)} → ${formatEuros(newAmount)}${when}, soit ${formatEuros(yearly)} de plus par an.`,
        alert_date: new Date().toISOString().slice(0, 10),
        dedup_key: `prix:${change.id}`,
      },
      { onConflict: "dedup_key", ignoreDuplicates: true },
    );
  }

  return { recorded: true, kind, id: change.id, alerted };
}
