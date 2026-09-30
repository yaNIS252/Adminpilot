"use client";

import { useRouter } from "next/navigation";
import { Check, Download } from "lucide-react";
import { useState } from "react";

import type { Enums } from "@/lib/supabase/types";

/**
 * Suivi d'une lettre : créée → envoyée → confirmée par le fournisseur.
 *
 * La confirmation n'est pas automatique : c'est l'utilisateur qui la reçoit,
 * par courrier ou par e-mail. La marquer retire l'abonnement du total et
 * annule ses rappels.
 */

const STEPS: { status: Enums<"cancel_status">; label: string }[] = [
  { status: "generated", label: "Lettre prête" },
  { status: "sent", label: "Envoyée" },
  { status: "confirmed", label: "Confirmée" },
];

export function LetterTracker({
  id,
  status,
  sentAt,
  provider,
}: {
  id: string;
  status: Enums<"cancel_status">;
  sentAt: string | null;
  provider: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reached = STEPS.findIndex((step) => step.status === status);

  async function move(next: Enums<"cancel_status">) {
    if (
      next === "confirmed" &&
      !window.confirm(
        `${provider} t’a bien confirmé la résiliation ? L’abonnement sortira de ton total et ses rappels seront supprimés.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/cancel/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => null);
    if (response?.ok) router.refresh();
    else setError("La mise à jour a échoué. Réessaie.");
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
        {STEPS.map((step, index) => (
          <li key={step.status} className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                index <= reached
                  ? "bg-[rgb(var(--accent-rgb)/.16)] text-[var(--accent-lighter)]"
                  : "bg-[rgba(255,255,255,.05)] text-[var(--text-faint)]"
              }`}
            >
              {index <= reached && <Check className="size-3" />}
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <span className="h-px w-4 bg-[var(--border-strong)]" aria-hidden />
            )}
          </li>
        ))}
      </ol>

      {sentAt && (
        <p className="m-0 text-xs text-[var(--text-faint)]">
          Envoyée le{" "}
          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(sentAt))}.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/cancel/${id}`}
          target="_blank"
          rel="noopener"
          className="btn-secondary h-10 px-4 text-sm"
        >
          <Download className="size-4" />
          Télécharger la lettre
        </a>
        {status === "generated" && (
          <button
            type="button"
            onClick={() => move("sent")}
            disabled={busy}
            className="btn-primary h-10 px-4 text-sm disabled:opacity-60"
          >
            Je l’ai envoyée
          </button>
        )}
        {status === "sent" && (
          <button
            type="button"
            onClick={() => move("confirmed")}
            disabled={busy}
            className="btn-primary h-10 px-4 text-sm disabled:opacity-60"
          >
            {provider} a confirmé
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="m-0 text-xs text-[var(--danger-light)]">
          {error}
        </p>
      )}
    </div>
  );
}
