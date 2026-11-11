/**
 * Échéances déduites des factures.
 *
 * L'IA lit ce que l'e-mail dit ; ce module complète ce qu'il ne dit pas, avec
 * des règles simples et vérifiables plutôt qu'une supposition du modèle :
 *
 *  · prochaine échéance absente mais date de facture et périodicité connues :
 *    facture + une période ;
 *  · échéance déjà passée (vieil e-mail transféré) : avancée de période en
 *    période jusqu'à la prochaine à venir ;
 *  · périodicité inconnue mais deux factures du même fournisseur : l'écart
 *    entre les deux la donne (≈ 30 jours → mensuel).
 */

type Cycle = "monthly" | "yearly" | "quarterly" | "weekly" | "one_time" | "unknown";

const PERIODIC = new Set<Cycle>(["monthly", "yearly", "quarterly", "weekly"]);

export function isPeriodic(cycle: string): cycle is "monthly" | "yearly" | "quarterly" | "weekly" {
  return PERIODIC.has(cycle as Cycle);
}

function parse(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const value = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Ajoute une période ; le 31 janvier + 1 mois donne le 28 (ou 29) février. */
export function addCycle(date: string, cycle: string): string | null {
  const value = parse(date);
  if (!value || !isPeriodic(cycle)) return null;
  if (cycle === "weekly") {
    value.setUTCDate(value.getUTCDate() + 7);
    return format(value);
  }
  const months = cycle === "monthly" ? 1 : cycle === "quarterly" ? 3 : 12;
  const day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, lastDay));
  return format(value);
}

/** Périodicité qui correspond à l'écart entre deux factures, ou `null`. */
export function cycleFromGap(previous: string, current: string): Cycle | null {
  const a = parse(previous);
  const b = parse(current);
  if (!a || !b) return null;
  const days = Math.abs(b.getTime() - a.getTime()) / 86_400_000;
  if (days >= 6 && days <= 8) return "weekly";
  if (days >= 26 && days <= 35) return "monthly";
  if (days >= 85 && days <= 97) return "quarterly";
  if (days >= 350 && days <= 380) return "yearly";
  return null;
}

/**
 * Prochaine échéance à venir, ou `null` si on ne peut pas la connaître sans
 * deviner.
 */
export function resolveRenewal(input: {
  nextRenewal: string | null;
  cycle: string;
  invoiceDate: string | null;
  today?: string;
}): string | null {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  let date = input.nextRenewal;

  if (!date && input.invoiceDate && isPeriodic(input.cycle)) {
    date = addCycle(input.invoiceDate, input.cycle);
  }
  if (!date || !parse(date)) return null;
  if (date >= today) return date;

  // Échéance passée : sans périodicité, on ne sait pas quand sera la suivante.
  if (!isPeriodic(input.cycle)) return null;
  for (let guard = 0; guard < 600 && date && date < today; guard += 1) {
    date = addCycle(date, input.cycle);
  }
  return date;
}

/**
 * Échéance à afficher et à suivre : la date connue si elle est à venir,
 * sinon avancée de période en période jusqu'à aujourd'hui ou après. Sans
 * périodicité (paiement unique, inconnue), une date passée ne mène nulle
 * part : `null`, et l'interface n'affiche pas de compte à rebours.
 *
 * Fonction pure, partagée par la tâche quotidienne et l'interface : le
 * compteur ne devient jamais négatif.
 */
export function getNextRenewal(date: string | null, cycle: string, now: Date = new Date()): string | null {
  const anchor = date ? parse(date) : null;
  if (!date || !anchor) return null;
  const today = format(now);
  if (date >= today) return date;
  if (!isPeriodic(cycle)) return null;

  // Chaque échéance est calculée depuis la date d'origine, pas depuis la
  // précédente : sinon le 31 janvier passerait au 28 février, puis resterait
  // au 28 tous les mois suivants.
  for (let step = 1; step < 2000; step += 1) {
    const next = shift(anchor, cycle, step);
    if (next >= today) return next;
  }
  return null;
}

function shift(anchor: Date, cycle: "monthly" | "yearly" | "quarterly" | "weekly", steps: number): string {
  if (cycle === "weekly") {
    return format(new Date(anchor.getTime() + steps * 7 * 86_400_000));
  }
  const months = (cycle === "monthly" ? 1 : cycle === "quarterly" ? 3 : 12) * steps;
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return format(new Date(Date.UTC(year, month, Math.min(anchor.getUTCDate(), lastDay))));
}
