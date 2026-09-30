"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lock, Palette, X } from "lucide-react";
import { useRef, useState } from "react";

import {
  ACCENTS,
  BACKGROUNDS,
  type AccentId,
  type BackgroundId,
} from "@/lib/constants";

/**
 * « Changer le thème » : fond et couleur secondaire.
 *
 * Aperçu en direct sur toute l'application pendant le choix — c'est l'écran
 * réel qui sert d'aperçu, rien ne vaut ça pour juger d'une teinte. « Annuler »
 * ou la touche Échap remettent le thème d'avant ; seul « Appliquer » écrit.
 */

type Theme = { accent: AccentId; background: BackgroundId };

function paint(theme: Theme) {
  document.querySelectorAll<HTMLElement>("[data-accent]").forEach((element) => {
    element.setAttribute("data-accent", theme.accent);
    element.setAttribute("data-bg", theme.background);
  });
}

export function ThemePicker({ initial, paid }: { initial: Theme; paid: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [saved, setSaved] = useState<Theme>(initial);
  const [draft, setDraft] = useState<Theme>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setDraft(saved);
    setError(null);
    dialog.current?.showModal();
  }

  function preview(next: Theme) {
    setDraft(next);
    paint(next);
  }

  function cancel() {
    paint(saved);
    setDraft(saved);
    dialog.current?.close();
  }

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (response.ok) {
        setSaved(draft);
        dialog.current?.close();
        router.refresh();
      } else {
        setError(
          response.status === 402
            ? "Ce thème est réservé aux formules Pro et Premium."
            : "Le thème n’a pas pu être enregistré. Réessaie.",
        );
      }
    } catch {
      setError("Connexion interrompue. Réessaie.");
    }
    setBusy(false);
  }

  const unchanged =
    draft.accent === saved.accent && draft.background === saved.background;

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <ThemeSample theme={saved} />
        <div className="min-w-[180px] flex-1 text-sm text-[var(--text-dim)]">
          Fond{" "}
          <strong className="text-[var(--text)]">
            {BACKGROUNDS.find((item) => item.id === saved.background)?.label}
          </strong>
          , couleur{" "}
          <strong className="text-[var(--text)]">
            {ACCENTS.find((item) => item.id === saved.accent)?.label.toLowerCase()}
          </strong>
          .
        </div>
        <button type="button" onClick={open} className="btn-secondary h-10 px-4 text-sm">
          <Palette className="size-4" />
          Changer le thème
        </button>
      </div>

      <dialog
        ref={dialog}
        onCancel={(event) => {
          event.preventDefault();
          cancel();
        }}
        aria-labelledby="theme-title"
        className="m-auto w-[min(520px,calc(100vw-32px))] rounded-[12px] border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-0 text-[var(--text)] backdrop:bg-[rgba(0,0,0,.55)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 id="theme-title" className="m-0 text-[15px] font-semibold">
            Thème de l’application
          </h2>
          <button
            type="button"
            onClick={cancel}
            aria-label="Fermer sans enregistrer"
            className="grid size-8 place-items-center rounded-lg text-[var(--text-faint)] hover:bg-[rgba(255,255,255,.06)] hover:text-[var(--text)]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-5">
          <p className="m-0 text-[13px] text-[var(--text-faint)]">
            L’aperçu s’applique en direct derrière cette fenêtre.
          </p>

          <Swatches
            label="Fond"
            items={BACKGROUNDS}
            value={draft.background}
            paid={paid}
            onPick={(background) => preview({ ...draft, background })}
            ring
          />
          <Swatches
            label="Couleur secondaire"
            items={ACCENTS}
            value={draft.accent}
            paid={paid}
            onPick={(accent) => preview({ ...draft, accent })}
          />

          {!paid && (
            <p className="m-0 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-faint)]">
              <Lock className="size-3" />
              Trois fonds et trois couleurs de plus avec Pro et Premium.
              <Link href="/reglages?formule=pro#formules" onClick={cancel}>
                Voir les formules
              </Link>
            </p>
          )}

          {error && (
            <p role="alert" className="m-0 text-[13px] text-[var(--danger-light)]">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
          <button type="button" onClick={cancel} className="btn-secondary h-10 px-4 text-sm">
            Annuler
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={busy || unchanged}
            className="btn-primary h-10 px-4 text-sm disabled:opacity-50"
          >
            {busy ? "Enregistrement…" : "Appliquer"}
          </button>
        </div>
      </dialog>
    </>
  );
}

function Swatches<T extends string>({
  label,
  items,
  value,
  paid,
  onPick,
  ring = false,
}: {
  label: string;
  items: readonly { id: T; label: string; hex: string; free: boolean }[];
  value: T;
  paid: boolean;
  onPick: (id: T) => void;
  /** Contour visible : un fond presque noir se confond sinon avec la fenêtre. */
  ring?: boolean;
}) {
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <legend className="mb-2.5 p-0 text-[13px] font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-3">
        {items.map((item) => {
          const locked = !item.free && !paid;
          const selected = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={locked}
              disabled={locked}
              onClick={() => onPick(item.id)}
              title={locked ? `${item.label} — avec Pro` : item.label}
              className="group flex w-[60px] flex-col items-center gap-1.5 disabled:cursor-not-allowed"
            >
              <span
                className={`relative grid size-10 place-items-center rounded-full border-2 transition-transform ${
                  selected
                    ? "border-[var(--text)]"
                    : ring
                      ? "border-[var(--border-strong)] group-enabled:group-hover:scale-105"
                      : "border-transparent group-enabled:group-hover:scale-105"
                } ${locked ? "opacity-45" : ""}`}
                style={{ background: item.hex }}
              >
                {selected && (
                  <Check className={`size-4 ${ring ? "text-white" : "text-[#16141f]"}`} />
                )}
                {locked && (
                  <span className="absolute -right-1 -bottom-1 grid size-[18px] place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)]">
                    <Lock className="size-2.5 text-[var(--text-dim)]" />
                  </span>
                )}
              </span>
              <span
                className={`text-[11px] ${selected ? "text-[var(--text)]" : "text-[var(--text-faint)]"}`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Vignette du thème en cours : fond, carte, barre de progression. */
function ThemeSample({ theme }: { theme: Theme }) {
  const background = BACKGROUNDS.find((item) => item.id === theme.background)!;
  const accent = ACCENTS.find((item) => item.id === theme.accent)!;
  return (
    <span
      aria-hidden
      className="flex h-12 w-20 flex-col justify-end gap-1.5 rounded-[8px] border border-[var(--border-strong)] p-2"
      style={{ background: background.hex }}
    >
      <span className="h-1.5 w-10 rounded-full bg-[rgba(255,255,255,.14)]" />
      <span className="h-1.5 rounded-full" style={{ background: accent.hex }} />
    </span>
  );
}
