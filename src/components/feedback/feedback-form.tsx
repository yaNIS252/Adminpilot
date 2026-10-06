"use client";

import { Star } from "lucide-react";
import { useState } from "react";

const LABELS = ["", "Décevant", "Bof", "Correct", "Bien", "Excellent"];

/**
 * Note sur 5 et commentaire facultatif. Partagé par la carte de
 * l'application et la page /avis (lien de l'e-mail).
 */
export function FeedbackForm({
  initialRating = 0,
  initialComment = "",
  onDone,
}: {
  initialRating?: number;
  initialComment?: string;
  onDone?: () => void;
}) {
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initialComment);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function submit() {
    if (!rating) return;
    setState("busy");
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating, comment }),
    }).catch(() => null);
    setState(response?.ok ? "done" : "error");
    if (response?.ok) onDone?.();
  }

  if (state === "done") {
    return (
      <p className="m-0 text-sm leading-[1.6] text-[var(--text-dim)]">
        <strong className="text-[var(--text)]">Merci !</strong>{" "}
        {rating >= 4
          ? "Ça nous fait très plaisir. Si AdminPilot t’aide, parles-en autour de toi : ton lien de parrainage offre un mois de Pro à tes proches (et à toi)."
          : "On lit chaque avis : ton retour va nous servir à améliorer AdminPilot."}
      </p>
    );
  }

  const shown = hover || rating;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} sur 5`}
              aria-pressed={rating === n}
              className="grid size-9 place-items-center rounded-md transition-transform hover:scale-110"
            >
              <Star
                className={`size-6 ${n <= shown ? "fill-[var(--accent)] text-[var(--accent)]" : "text-[var(--text-faint)]"}`}
              />
            </button>
          ))}
        </div>
        {shown > 0 && <span className="text-sm text-[var(--text-dim)]">{LABELS[shown]}</span>}
      </div>
      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={
              rating >= 4
                ? "Qu’est-ce qui te plaît le plus ? (facultatif)"
                : "Qu’est-ce qui manque ou ne marche pas ? (facultatif)"
            }
            className="rounded-[8px] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={state === "busy"}
              className="btn-primary h-10 px-4 text-sm disabled:opacity-60"
            >
              Envoyer mon avis
            </button>
            {state === "error" && (
              <span className="text-[13px] text-[var(--danger)]">Envoi impossible, réessaie.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
