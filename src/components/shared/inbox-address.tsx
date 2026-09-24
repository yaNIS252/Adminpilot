"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/**
 * Adresse d'ingestion, avec copie en un geste.
 *
 * Cette adresse est saisie dans les réglages Gmail : la recopier à la main est
 * le moyen le plus sûr de se tromper d'un caractère et de ne jamais comprendre
 * pourquoi rien n'arrive.
 */
export function InboxAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier indisponible (contexte non sécurisé, permission refusée) :
      // l'adresse reste sélectionnable à la main, rien n'est bloqué.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="mono min-w-0 flex-1 overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 py-2.5 text-sm whitespace-nowrap">
        {address}
      </code>
      <button
        type="button"
        onClick={copy}
        className={`flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-3.5 py-2.5 text-sm font-medium transition-colors ${
          copied
            ? "bg-[rgba(63,207,149,.15)] text-[var(--positive-light)]"
            : "bg-gradient-to-b from-[#9888f7] to-[#5b4bd6] text-white"
        }`}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copié" : "Copier"}
      </button>
    </div>
  );
}
