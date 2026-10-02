"use client";

import { useState } from "react";

/** Interrupteur du récapitulatif mensuel par e-mail. */
export function RecapToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ monthly_recap: next }),
    }).catch(() => null);
    if (!response?.ok) {
      setEnabled(!next);
      setError("Le changement n’a pas pu être enregistré.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <p className="m-0 flex-1 text-sm text-[var(--text-dim)]">
          Le 1er de chaque mois : ton total, les hausses et baisses de prix, les
          nouveaux abonnements, les résiliations et les échéances à venir.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Recevoir le récap mensuel"
          onClick={toggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            enabled ? "bg-[var(--accent)]" : "bg-[rgba(255,255,255,.12)]"
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${enabled ? "left-[22px]" : "left-0.5"}`}
          />
        </button>
      </div>
      {error && (
        <p role="alert" className="m-0 text-xs text-[var(--danger-light)]">
          {error}
        </p>
      )}
    </div>
  );
}
