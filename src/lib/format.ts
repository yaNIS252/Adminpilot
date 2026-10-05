/**
 * Formatage français. Centralisé pour que « 13,49 € » et « 3 octobre 2026 »
 * s'écrivent partout de la même façon.
 */

export function formatAmount(
  amount: number | null,
  currency = "EUR",
): string | null {
  if (amount === null) return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}

/** Jours restants avant une date, en UTC pour éviter les décalages de fuseau. */
export function daysUntil(iso: string): number {
  const target = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function formatRelativeDeadline(iso: string): string {
  const days = daysUntil(iso);
  if (days < 0) return "échéance passée";
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days < 31) return `dans ${days} jours`;
  const months = Math.round(days / 30);
  return `dans ${months} mois`;
}

const CYCLE_LABELS: Record<string, string> = {
  monthly: "par mois",
  yearly: "par an",
  quarterly: "par trimestre",
  weekly: "par semaine",
  one_time: "paiement unique",
  unknown: "",
};

export function formatCycle(cycle: string): string {
  return CYCLE_LABELS[cycle] ?? "";
}

/**
 * Ramène un montant à son équivalent mensuel, pour additionner des cycles
 * différents. Un abonnement annuel à 49 € pèse 4,08 € par mois dans le total —
 * l'afficher à 49 € fausserait complètement la vue d'ensemble.
 */
export function monthlyEquivalent(
  amount: number | null,
  cycle: string,
): number {
  if (amount === null) return 0;
  switch (cycle) {
    case "monthly":
      return amount;
    case "yearly":
      return amount / 12;
    case "quarterly":
      return amount / 3;
    case "weekly":
      return (amount * 52) / 12;
    default:
      // Paiement unique ou cycle inconnu : ne rien inventer plutôt que de
      // gonfler un total que l'utilisateur prendra pour argent comptant.
      return 0;
  }
}

/** Horodatage ISO d'il y a `days` jours, pour borner une requête. */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Date du jour au format `YYYY-MM-DD` (UTC). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fin d'un essai gratuit en cours, lue dans les métadonnées d'un abonnement,
 * ou `null` s'il n'y en a pas (ou plus).
 */
export function activeTrialUntil(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const until = (metadata as Record<string, unknown>).trial_until;
  if (typeof until !== "string") return null;
  return until >= new Date().toISOString().slice(0, 10) ? until : null;
}
