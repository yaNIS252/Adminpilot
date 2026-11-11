import { formatAmount, formatCycle } from "@/lib/format";

/**
 * Essai gratuit en cours : pastille à côté du nom, et sous-texte en deux
 * morceaux qui se replient proprement sur un écran de 375 px (« Gratuit
 * jusqu’au 20 nov. » puis « puis 12,99 € par mois »), au lieu d’une
 * seule phrase coupée n'importe où.
 */

const SHORT_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

function shortDate(iso: string): string {
  return SHORT_DATE.format(new Date(`${iso}T00:00:00Z`));
}

export function TrialBadge() {
  return (
    <span
      title="Le premier prélèvement aura lieu à la fin de l'essai"
      className="inline-flex shrink-0 items-center rounded-full bg-[rgba(63,207,149,.15)] px-1.5 py-px text-[10px] leading-4 font-semibold whitespace-nowrap text-[var(--positive-light)]"
    >
      Essai gratuit
    </span>
  );
}

export function TrialNote({
  until,
  amount,
  currency,
  cycle,
}: {
  until: string;
  amount: number | null;
  currency: string;
  cycle: string;
}) {
  const price = formatAmount(amount, currency);
  const period = formatCycle(cycle);
  return (
    <span className="flex flex-col">
      <span>Gratuit jusqu’au {shortDate(until)}</span>
      <span>
        puis {price ?? "montant inconnu"}
        {period ? ` ${period}` : ""}
      </span>
    </span>
  );
}
