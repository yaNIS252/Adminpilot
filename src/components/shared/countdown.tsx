import { daysUntil } from "@/lib/format";

/**
 * Compte à rebours avant une échéance, lisible d'un coup d'œil.
 *
 * Le chiffre est mis en avant (« 3 j ») et la couleur dit l'urgence : rouge
 * à trois jours ou moins, ambre à dix jours, neutre au-delà. Pour un essai
 * gratuit, le ton est toujours au moins ambre : c'est le moment où l'on peut
 * encore partir sans rien payer.
 */
export function Countdown({
  iso,
  trial = false,
  size = "sm",
}: {
  iso: string;
  trial?: boolean;
  size?: "sm" | "lg";
}) {
  const days = Math.max(0, daysUntil(iso));
  const tone =
    days <= 3
      ? "bg-[rgba(240,113,104,.16)] text-[var(--danger-light)] ring-[rgba(240,113,104,.35)]"
      : days <= 10 || trial
        ? "bg-[rgba(224,161,56,.16)] text-[var(--warning-light)] ring-[rgba(224,161,56,.35)]"
        : "bg-[var(--surface-raised)] text-[var(--text-dim)] ring-[var(--border)]";
  const label = days === 0 ? "aujourd’hui" : days === 1 ? "demain" : null;

  if (size === "lg") {
    return (
      <span
        className={`inline-flex shrink-0 flex-col items-center justify-center rounded-[10px] px-3 py-1.5 ring-1 ${tone}`}
      >
        {label ? (
          <span className="text-[15px] leading-5 font-semibold">{label}</span>
        ) : (
          <span className="mono text-[22px] leading-6 font-bold">
            {days}
            <span className="ml-0.5 text-[12px] font-semibold">j</span>
          </span>
        )}
        <span className="text-[10px] leading-3 opacity-80">
          {trial ? "avant le 1er paiement" : "avant l’échéance"}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`mono inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ${tone}`}
    >
      {trial && <span className="font-sans">Essai ·</span>}
      {label ?? `J-${days}`}
    </span>
  );
}
