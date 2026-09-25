"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useState } from "react";

import { PLAN_PRICES } from "@/lib/constants";

/**
 * Tarifs, avec bascule mensuel / annuel.
 *
 * En annuel, on affiche le coût mensuel équivalent plutôt que la somme
 * annuelle : c'est la comparaison que l'utilisateur fait dans sa tête, et
 * afficher « 49 € » à côté de « 5,99 € » donnerait l'impression d'un
 * renchérissement.
 */

function monthlyEquivalent(yearly: number): string {
  return `${(yearly / 12).toFixed(2).replace(".", ",")} €`;
}

export function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <>
      <div className="mb-9 flex justify-center">
        <div
          role="group"
          aria-label="Périodicité de facturation"
          className="flex gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[rgba(255,255,255,.03)] p-1"
        >
          <Toggle active={!yearly} onClick={() => setYearly(false)}>
            Mensuel
          </Toggle>
          <Toggle active={yearly} onClick={() => setYearly(true)}>
            Annuel
            <span className="rounded-full bg-[rgba(63,207,149,.15)] px-[7px] py-0.5 text-[11px] font-semibold text-[var(--positive-light)]">
              jusqu&apos;à −32 %
            </span>
          </Toggle>
        </div>
      </div>

      <div className="grid items-stretch gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <Plan
          name="Gratuit"
          price="0 €"
          suffix="pour toujours"
          features={["5 abonnements suivis", "10 documents", "1 alerte par mois"]}
          cta="Commencer"
        />

        <Plan
          name="Pro"
          price={
            yearly
              ? monthlyEquivalent(PLAN_PRICES.pro.yearly)
              : `${PLAN_PRICES.pro.monthly.toFixed(2).replace(".", ",")} €`
          }
          suffix="/mois"
          note={
            yearly
              ? `Facturé ${PLAN_PRICES.pro.yearly} € par an`
              : "Sans engagement"
          }
          features={[
            "Abonnements et alertes illimités",
            "500 documents · recherche illimitée",
            "3 résiliations par mois",
          ]}
          cta="Passer Pro"
          highlight
        />

        <Plan
          name="Famille"
          price={
            yearly
              ? monthlyEquivalent(PLAN_PRICES.family.yearly)
              : `${PLAN_PRICES.family.monthly.toFixed(2).replace(".", ",")} €`
          }
          suffix="/mois"
          note={
            yearly
              ? `Facturé ${PLAN_PRICES.family.yearly} € par an`
              : "Sans engagement"
          }
          features={[
            "Tout le plan Pro",
            "1 000 documents",
            "Résiliations illimitées · 5 membres",
          ]}
          cta="Choisir Famille"
        />
      </div>
    </>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-[var(--radius-sm)] px-4 py-2.5 text-sm font-medium transition-all ${
        active
          ? "bg-[rgba(139,124,240,.22)] text-white shadow-[inset_0_0_0_1px_rgba(139,124,240,.45),0_0_20px_-6px_rgba(139,124,240,.8)]"
          : "text-[var(--text-dim)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

function Plan({
  name,
  price,
  suffix,
  note,
  features,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  suffix: string;
  note?: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}) {
  const body = (
    <div
      className={`flex h-full flex-col rounded-[var(--radius-2xl)] p-7 ${
        highlight
          ? "bg-gradient-to-b from-[#17152a] to-[#0f0f18]"
          : "border border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div
        className={`text-[15px] font-semibold ${
          highlight ? "text-[var(--accent-lighter)]" : ""
        }`}
      >
        {name}
      </div>

      <div className="mt-3.5 flex items-baseline gap-1.5">
        <span className="mono text-[44px] font-bold tracking-[-0.03em]">
          {price}
        </span>
        <span className="text-sm text-[var(--text-faint)]">{suffix}</span>
      </div>

      <div className="h-5 text-[13px] text-[var(--text-faint)]">{note}</div>

      <ul className="m-0 mt-[22px] mb-7 flex flex-1 list-none flex-col gap-[11px] p-0 text-sm">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2.5">
            <Check
              className={`mt-[3px] size-4 shrink-0 ${
                highlight
                  ? "text-[var(--accent-light)]"
                  : "text-[var(--text-faint)]"
              }`}
            />
            <span
              className={
                highlight ? "text-[var(--text-soft)]" : "text-[var(--text-muted)]"
              }
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href="/login"
        className={`block rounded-[var(--radius)] py-3 text-center text-sm font-semibold transition-shadow ${
          highlight
            ? "bg-gradient-to-b from-[#7c6ae9] via-[#5744cf] to-[#3a2ca6] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.45),inset_0_0_0_1px_rgba(255,255,255,.2),0_8px_30px_-8px_rgba(139,124,240,.9)] hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,.55),0_0_44px_-4px_rgba(139,124,240,1)]"
            : "border border-[var(--border-strong)] bg-[rgba(255,255,255,.03)] text-[var(--text)] hover:bg-[rgba(255,255,255,.08)] hover:text-white"
        }`}
      >
        {cta}
      </Link>
    </div>
  );

  if (!highlight) return body;

  // Bordure en dégradé : un conteneur d'un pixel et demi qui porte le dégradé,
  // avec la carte posée dessus. `border-image` ne permet pas de coins arrondis.
  return (
    <div className="relative rounded-[21px] bg-gradient-to-br from-[#b4a8ff] via-[#6f7cf5] to-[#8b7cf0] p-[1.5px] shadow-[0_30px_80px_-30px_rgba(139,124,240,.7)]">
      <span className="anim-pulse absolute -top-[13px] left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#8b7cf0] to-[#6f7cf5] px-3 py-[5px] text-xs font-semibold whitespace-nowrap text-white shadow-[0_0_24px_rgba(139,124,240,.8)]">
        Plus populaire
      </span>
      {body}
    </div>
  );
}
