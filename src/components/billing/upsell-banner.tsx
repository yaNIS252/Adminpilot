"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { UPSELL_COOKIE } from "@/lib/constants";

const HIDE_DAYS = 30;

/**
 * Bannière « Passer Pro » de l'accueil, pour les comptes gratuits.
 *
 * Refermable, et elle reste fermée un mois : une incitation qu'on ne peut pas
 * faire taire devient une nuisance, et une nuisance fait partir plus sûrement
 * qu'elle ne fait payer. Les rappels contextuels (cadenas, limites atteintes)
 * restent en place, eux : ils arrivent au moment où la limite gêne.
 */
export function UpsellBanner() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  function dismiss() {
    document.cookie = `${UPSELL_COOKIE}=1; Max-Age=${HIDE_DAYS * 86_400}; Path=/; SameSite=Lax`;
    setHidden(true);
  }

  return (
    <section className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-[10px] border border-[rgb(var(--accent-rgb)/.35)] bg-[var(--accent-soft)] py-4 pr-12 pl-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[rgb(var(--accent-rgb)/.16)] text-[var(--accent-lighter)]">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-[220px] flex-1">
        <div className="text-[15px] font-semibold">
          Passe Pro pour 5,99 € par mois
        </div>
        <p className="m-0 mt-0.5 text-[13px] leading-[1.5] text-[var(--text-dim)]">
          Abonnements et documents illimités, recherche en langage courant,
          lettres de résiliation prêtes à envoyer. En couple ou en famille,
          Premium couvre jusqu’à 5 comptes.
        </p>
      </div>
      <Link href="/reglages?formule=pro#formules" className="btn-primary h-10 px-4 text-[13px]">
        Voir les formules
        <ArrowRight className="size-4" />
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Masquer cette bannière"
        title="Masquer"
        className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[rgba(255,255,255,.06)] hover:text-[var(--text)]"
      >
        <X className="size-4" />
      </button>
    </section>
  );
}
