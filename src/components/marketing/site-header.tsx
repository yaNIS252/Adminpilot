"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { LogoMark } from "@/components/marketing/logo-mark";

/**
 * En-tête des pages publiques.
 *
 * Une barre pleine largeur soulignée d'un filet, et non plus une pilule
 * flottante en verre dépoli — autre signature des pages générées. La pastille
 * « hébergé dans l'UE » passe dans le pied de page : c'est une information de
 * réassurance, pas de navigation.
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
  { href: "/#faq", label: "Questions" },
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
    <header className="sticky top-0 z-50 border-b border-[var(--border-soft)] bg-[rgba(10,10,15,.82)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1160px] items-center gap-3 px-5 sm:gap-6">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex shrink-0 items-center gap-2.5 text-[var(--text-bright)] hover:text-[var(--text-bright)]"
        >
          <LogoMark />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">
            AdminPilot
          </span>
        </Link>

        <nav className="hidden gap-6 lg:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text-bright)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        <Link
          href="/login"
          className="hidden text-sm whitespace-nowrap text-[var(--text-muted)] transition-colors hover:text-[var(--text-bright)] lg:inline"
        >
          Connexion
        </Link>

        <Link
          href="/login"
          className="btn-primary h-9 shrink-0 px-3.5 text-sm whitespace-nowrap sm:px-4"
        >
          Commencer
          <ArrowRight className="size-3.5" />
        </Link>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          className="grid size-9 shrink-0 place-items-center rounded-[8px] border border-[var(--border)] text-[var(--text-muted)] lg:hidden"
        >
          {open ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
        </button>
      </div>

      {open && (
        <>
          {/* Voile cliquable : fermer en touchant à côté est le geste attendu. */}
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-16 z-40 cursor-default bg-black/60 lg:hidden"
          />

          <nav className="absolute inset-x-0 top-16 z-50 border-b border-[var(--border)] bg-[var(--bg)] px-5 pt-2 pb-5 lg:hidden">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between border-b border-[var(--border-soft)] py-3.5 text-[17px] text-[var(--text-soft)] hover:text-[var(--text-bright)]"
              >
                {link.label}
                <ArrowRight className="size-4 text-[var(--text-ghost)]" />
              </Link>
            ))}

            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="btn-secondary mt-5 h-11 w-full text-[15px]"
            >
              J&apos;ai déjà un compte
            </Link>
          </nav>
        </>
      )}
    </header>
  );
}
