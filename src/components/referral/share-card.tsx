"use client";

import { Gift, X } from "lucide-react";
import { useState } from "react";

import { ShareActions } from "@/components/referral/share-actions";
import { SHARE_COOKIE } from "@/lib/constants";

/**
 * Carte « Et tes proches ? » du tableau de bord, après la première détection.
 *
 * Le montant affiché est celui de l'utilisateur ; il ne part dans le message
 * que s'il choisit de partager. Le lien ne contient que le code de parrainage.
 * Refermable une fois pour toutes.
 */
export function ShareCard({ link, monthly }: { link: string; monthly: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  function dismiss() {
    document.cookie = `${SHARE_COOKIE}=1; Max-Age=${365 * 86_400}; Path=/; SameSite=Lax`;
    setHidden(true);
  }

  return (
    <section className="card-sheen anim-up relative flex flex-col gap-3.5 rounded-[var(--radius-xl)] border border-[rgb(var(--accent-rgb)/.35)] py-5 pr-12 pl-5">
      <div className="flex items-start gap-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[rgb(var(--accent-rgb)/.16)] text-[var(--accent-lighter)]">
          <Gift className="size-4" />
        </span>
        <div>
          <div className="text-[15px] font-semibold">
            Tu paies {monthly} par mois en abonnements (hors AdminPilot). Et tes proches ?
          </div>
          <p className="m-0 mt-0.5 text-[13px] leading-[1.5] text-[var(--text-dim)]">
            Offre-leur 1 mois de Pro avec ton lien. Quand ils s’en servent, tu
            reçois toi aussi 1 mois offert.
          </p>
        </div>
      </div>
      <ShareActions
        link={link}
        message={`Je viens de découvrir que je paie ${monthly} par mois en abonnements. Et toi ? Avec mon lien, AdminPilot t’offre 1 mois de Pro :`}
      />
      <button
        type="button"
        onClick={dismiss}
        aria-label="Masquer cette carte"
        title="Masquer"
        className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[rgba(255,255,255,.06)] hover:text-[var(--text)]"
      >
        <X className="size-4" />
      </button>
    </section>
  );
}
