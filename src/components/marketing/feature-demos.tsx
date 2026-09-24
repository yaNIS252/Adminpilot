"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * Les deux encarts animés des cartes de fonctionnalités.
 *
 * Purement illustratifs : ils montrent le geste plutôt que de le décrire. Tous
 * deux respectent `prefers-reduced-motion` — quelqu'un qui demande moins de
 * mouvement voit l'état final, pas une image figée à mi-parcours.
 */

/**
 * `useSyncExternalStore` plutôt qu'un `useState` alimenté par un effet : la
 * media query est un état externe au rendu, et l'écrire depuis un effet
 * provoquerait un rendu en cascade à chaque montage.
 *
 * Le troisième argument est l'instantané côté serveur — `false`, faute de
 * `window` au rendu serveur.
 */
function usePrefersReducedMotion(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Compteur d'emails analysés, avec la barre qui balaie. */
export function ScanDemo() {
  const reduced = usePrefersReducedMotion();
  const [count, setCount] = useState(212);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(
      () => setCount((value) => (value < 1480 ? value + 7 : 212)),
      1000,
    );
    return () => clearInterval(timer);
  }, [reduced]);

  return (
    <>
      <div className="flex justify-between text-xs text-[var(--text-faint)]">
        <span className="flex items-center gap-1.5">
          <LoaderCircle
            className={`size-3.5 text-[#aab3ff] ${reduced ? "" : "anim-spin"}`}
          />
          Analyse en cours
        </span>
        <span className="mono text-[var(--text)]">
          {count.toLocaleString("fr-FR")} emails
        </span>
      </div>

      <div className="relative mt-2.5 h-1.5 overflow-hidden rounded-md bg-[rgba(255,255,255,.06)]">
        <div
          className={`absolute inset-y-0 w-[30%] ${reduced ? "left-0" : "anim-scan"}`}
          style={{
            background:
              "linear-gradient(90deg,transparent,#8b7cf0,transparent)",
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {["Netflix · 13,49 €", "EDF · 86,89 €", "Free Mobile · 19,99 €"].map(
          (chip) => (
            <span
              key={chip}
              className="rounded-full bg-[rgba(63,207,149,.1)] px-[9px] py-[3px] text-[11px] text-[var(--positive-pale)]"
            >
              {chip}
            </span>
          ),
        )}
        <span className="rounded-full bg-[rgba(255,255,255,.05)] px-[9px] py-[3px] text-[11px] text-[var(--text-faint)]">
          Newsletter ignorée
        </span>
      </div>
    </>
  );
}

const QUERY = "ma facture EDF de mars";

/** Recherche en langage courant, tapée caractère par caractère. */
export function SearchDemo() {
  const reduced = usePrefersReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced) return;
    // Le cycle fait 46 pas : la frappe, puis une pause avant de recommencer.
    const timer = setInterval(() => setTick((value) => (value + 1) % 46), 110);
    return () => clearInterval(timer);
  }, [reduced]);

  const typed = reduced ? QUERY : QUERY.slice(0, Math.min(tick, QUERY.length));
  const showResult = reduced || tick >= QUERY.length + 3;

  return (
    <>
      <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[rgba(255,255,255,.04)] px-3 py-2.5 text-sm">
        <Search className="size-4 shrink-0 text-[var(--text-faint)]" />
        <span className="min-h-[1.2em]">{typed}</span>
        {!reduced && (
          <span className="anim-caret h-4 w-[1.5px] bg-[var(--accent-light)]" />
        )}
      </div>

      <div
        className="mt-2.5 flex items-center gap-2.5 rounded-[var(--radius-sm)] border border-[rgba(63,207,149,.2)] bg-[rgba(63,207,149,.06)] px-2.5 py-[9px] transition-all duration-300"
        style={{
          opacity: showResult ? 1 : 0,
          transform: showResult ? "none" : "translateY(6px)",
        }}
      >
        <span className="grid h-9 w-[30px] shrink-0 place-items-center rounded-[5px] bg-[rgba(111,124,245,.14)] text-[11px] font-semibold text-[#aab3ff]">
          PDF
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">
            Facture_EDF_2026-03.pdf
          </div>
          <div className="text-[11px] text-[var(--text-faint)]">
            Énergie · 86,89 € · classé automatiquement
          </div>
        </div>
      </div>
    </>
  );
}
