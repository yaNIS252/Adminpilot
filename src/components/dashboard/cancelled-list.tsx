"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useState } from "react";

import { formatAmount, formatDate } from "@/lib/format";

/**
 * Abonnements résiliés : gardés à part plutôt que supprimés, pour voir ce
 * que les résiliations rapportent et reprendre le suivi d'un abonnement
 * auquel on se réabonne.
 */

export type CancelledSubscription = {
  id: string;
  provider: string;
  monthly: number;
  cancelledAt: string | null;
  effectiveDate: string | null;
  viaEmail: boolean;
};

export function CancelledList({ items }: { items: CancelledSubscription[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resume(id: string) {
    setBusy(id);
    setError(null);
    const response = await fetch("/api/subscriptions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status: "active" }),
    }).catch(() => null);
    setBusy(null);
    if (response?.ok) router.refresh();
    else setError("Le suivi n’a pas pu reprendre. Réessaie.");
  }

  return (
    <>
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--border-soft)] py-2.5 last:border-b-0"
          >
            <div className="min-w-[10rem] flex-1">
              <div className="text-sm font-medium">{item.provider}</div>
              <div className="text-xs text-[var(--text-faint)]">
                {[
                  item.cancelledAt ? `résilié le ${formatDate(item.cancelledAt.slice(0, 10))}` : "résilié",
                  item.effectiveDate ? `accès jusqu’au ${formatDate(item.effectiveDate)}` : null,
                  item.viaEmail ? "confirmé par e-mail" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            {item.monthly > 0 && (
              <span className="mono text-[13px] text-[var(--positive-light)]">
                −{formatAmount(item.monthly)}/mois
              </span>
            )}
            <button
              type="button"
              onClick={() => resume(item.id)}
              disabled={busy === item.id}
              className="btn-secondary h-8 px-3 text-xs disabled:opacity-60"
            >
              <RotateCcw className="size-3.5" />
              Reprendre le suivi
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="m-0 mt-2 text-[13px] text-[var(--danger-light)]">
          {error}
        </p>
      )}
    </>
  );
}
