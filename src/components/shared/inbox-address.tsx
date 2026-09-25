"use client";

import { Check, Copy, TextSelect } from "lucide-react";
import { useRef, useState } from "react";

/**
 * Adresse d'ingestion, avec copie en un geste.
 *
 * Cette adresse est saisie dans les réglages Gmail : la recopier à la main est
 * le moyen le plus sûr de se tromper d'un caractère et de ne jamais comprendre
 * pourquoi rien n'arrive.
 *
 * Utilisée par l'onboarding ET par les réglages. L'onboarding en avait sa
 * propre copie, qui avait le même défaut que celle-ci : quand le presse-papier
 * était refusé, le bouton ne faisait rien du tout, sans le moindre retour.
 */
export function InboxAddress({ address }: { address: string }) {
  const [state, setState] = useState<"idle" | "copied" | "selected">("idle");
  const codeRef = useRef<HTMLElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setState("copied");
    } catch {
      // Presse-papier refusé — ça arrive vraiment : navigateurs intégrés aux
      // applis (Gmail, Instagram sur mobile), permission refusée, page sans
      // focus. On sélectionne alors l'adresse, pour qu'il ne reste qu'à faire
      // Ctrl+C ou « Copier » dans le menu du téléphone. Ne rien faire du tout
      // laisserait l'utilisateur bloqué à la toute première étape.
      const node = codeRef.current;
      const selection = window.getSelection();
      if (node && selection) {
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setState("selected");
    }
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code
        ref={codeRef}
        className="mono min-w-0 flex-1 overflow-x-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface-alt)] px-3.5 py-2.5 text-[13px] whitespace-nowrap select-all"
      >
        {address}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-live="polite"
        className={`h-10 shrink-0 px-4 text-sm ${
          state === "idle"
            ? "btn-primary"
            : "inline-flex items-center gap-1.5 rounded-[8px] bg-[rgba(63,207,149,.15)] font-medium text-[var(--positive-light)]"
        }`}
      >
        {state === "copied" ? (
          <Check className="size-4" />
        ) : state === "selected" ? (
          <TextSelect className="size-4" />
        ) : (
          <Copy className="size-4" />
        )}
        {state === "copied"
          ? "Copié"
          : state === "selected"
            ? "Sélectionné, fais Ctrl+C"
            : "Copier"}
      </button>
    </div>
  );
}
