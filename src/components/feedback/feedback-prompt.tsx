"use client";

import { MessageSquareHeart, X } from "lucide-react";
import { useState } from "react";

import { FeedbackForm } from "@/components/feedback/feedback-form";

/**
 * Carte « Ton avis », deux semaines après l'inscription. Refermée, elle ne
 * revient plus ; l'e-mail d'un mois prend le relais.
 */
export function FeedbackPrompt() {
  const [hidden, setHidden] = useState(false);
  const [done, setDone] = useState(false);
  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    if (done) return;
    void fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dismiss: true }),
    }).catch(() => null);
  }

  return (
    <section className="anim-up mb-5 rounded-[var(--radius-xl)] border border-[rgb(var(--accent-rgb)/.3)] bg-[var(--accent-soft)] p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <MessageSquareHeart className="mt-0.5 size-4 shrink-0 text-[var(--accent-lighter)]" />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-semibold text-[var(--text)]">Que penses-tu d’AdminPilot ?</p>
          <p className="m-0 mt-0.5 text-[13px] text-[var(--text-dim)]">
            Deux semaines déjà ! Ta note nous aide à savoir quoi améliorer.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          title="Fermer"
          className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--text-faint)] transition-colors hover:bg-[rgba(255,255,255,.06)] hover:text-[var(--text)]"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <FeedbackForm onDone={() => setDone(true)} />
    </section>
  );
}
