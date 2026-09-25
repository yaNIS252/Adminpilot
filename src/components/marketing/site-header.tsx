"use client";

import Link from "next/link";
import { ArrowRight, Menu, Send, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * En-tête des pages publiques.
 *
 * Sur mobile, la navigation passe dans un panneau dépliant. Sans lui, les
 * quatre entrées et surtout « Connexion » disparaissaient purement et
 * simplement : un utilisateur déjà inscrit arrivant depuis son téléphone
 * n'avait plus aucun moyen d'entrer, sinon deviner l'URL.
 */

const LINKS = [
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/resilier", label: "Guides" },
  { href: "/#faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  // Le panneau ouvert fige le défilement de la page derrière lui : sans ça,
  // un balayage fait glisser le contenu sous le menu.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 px-4 py-3.5 sm:px-5">
      <div className="mx-auto flex max-w-[1160px] items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[rgba(14,14,20,.75)] py-2.5 pr-2.5 pl-3.5 backdrop-blur-xl sm:gap-5 sm:pr-3 sm:pl-4">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex shrink-0 items-center gap-2.5 text-[var(--text-bright)] hover:text-[var(--text-bright)]"
        >
          <span className="anim-pulse grid size-[30px] place-items-center rounded-[var(--radius-sm)] bg-gradient-to-br from-[#8b7cf0] via-[#5b4bd6] to-[#3b2fa8] shadow-[0_0_18px_rgba(139,124,240,.5),inset_0_1px_0_rgba(255,255,255,.3)]">
            <Send className="size-[15px] text-white" />
          </span>
          <span className="text-base font-bold tracking-[-0.02em]">
            AdminPilot
          </span>
        </Link>

        <nav className="ml-3 hidden gap-1 lg:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[var(--radius-sm)] px-3 py-[7px] text-sm text-[var(--text-dim)] transition-colors hover:bg-[rgba(255,255,255,.05)] hover:text-[var(--text-bright)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        <span className="hidden items-center gap-2 rounded-full border border-[rgba(63,207,149,.22)] bg-[rgba(63,207,149,.06)] px-3 py-1.5 text-xs whitespace-nowrap text-[var(--positive-pale)] xl:inline-flex">
          <span className="anim-dot size-[7px] rounded-full bg-[var(--positive)] shadow-[0_0_8px_var(--positive)]" />
          Données hébergées dans l&apos;Union européenne
        </span>

        <Link
          href="/login"
          className="hidden px-2.5 py-2 text-sm whitespace-nowrap text-[var(--text-muted)] hover:text-white lg:inline"
        >
          Connexion
        </Link>

        <Link
          href="/login"
          className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius)] bg-gradient-to-b from-[#7c6ae9] via-[#5744cf] to-[#3a2ca6] px-3.5 py-2.5 text-sm font-bold whitespace-nowrap text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),inset_0_0_0_1px_rgba(255,255,255,.2),0_6px_20px_-6px_rgba(139,124,240,.7)] transition-all hover:-translate-y-px hover:text-white sm:px-4"
        >
          Commencer
          <ArrowRight className="size-3.5" />
        </Link>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-muted)] lg:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <>
          {/* Voile cliquable : fermer en touchant à côté est le geste attendu. */}
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/50 lg:hidden"
          />

          <nav className="relative z-50 mx-auto mt-2 max-w-[1160px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[rgba(14,14,20,.97)] p-2 backdrop-blur-xl lg:hidden">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-[var(--radius-sm)] px-3.5 py-3 text-[15px] text-[var(--text-soft)] hover:bg-[rgba(255,255,255,.05)] hover:text-white"
              >
                {link.label}
                <ArrowRight className="size-4 text-[var(--text-ghost)]" />
              </Link>
            ))}

            <div className="my-1.5 h-px bg-[var(--border)]" />

            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-[var(--radius-sm)] px-3.5 py-3 text-[15px] font-medium text-[var(--accent-light)] hover:bg-[rgba(139,124,240,.1)]"
            >
              J&apos;ai déjà un compte
              <ArrowRight className="size-4" />
            </Link>

            <div className="flex items-center gap-2 px-3.5 py-2.5 text-xs text-[var(--positive-pale)]">
              <span className="anim-dot size-[7px] rounded-full bg-[var(--positive)]" />
              Données hébergées dans l&apos;Union européenne
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
