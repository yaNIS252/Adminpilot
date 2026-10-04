"use client";

import Link from "next/link";
import { Gift, X } from "lucide-react";
import { useState } from "react";

import { REFERRAL_BANNER_COOKIE } from "@/lib/constants";

const HIDE_DAYS = 60;

/**
 * Bande de parrainage en haut de l'application. Discrète, une ligne, et
 * refermable : elle reste fermée deux mois.
 */
export function ReferralBanner() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  function dismiss() {
    document.cookie = `${REFERRAL_BANNER_COOKIE}=1; Max-Age=${HIDE_DAYS * 86_400}; Path=/; SameSite=Lax`;
    setHidden(true);
  }

  return (
    <div className="mb-5 flex items-center gap-3 rounded-[10px] border border-[rgb(var(--accent-rgb)/.3)] bg-[var(--accent-soft)] py-2 pr-2 pl-3.5 text-[13px]">
      <Gift className="size-4 shrink-0 text-[var(--accent-lighter)]" />
      <p className="m-0 min-w-0 flex-1 text-[var(--text-dim)]">
        <strong className="font-semibold text-[var(--text)]">Offre 1 mois de Pro à tes proches</strong>
        <span className="hidden sm:inline"> — et reçois-en un toi aussi.</span>
      </p>
      <Link href="/reglages#parrainage" className="shrink-0 font-medium text-[var(--accent-lighter)]">
        Mon lien
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Masquer la bande de parrainage"
        title="Masquer"
        className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--text-faint)] transition-colors hover:bg-[rgba(255,255,255,.06)] hover:text-[var(--text)]"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
