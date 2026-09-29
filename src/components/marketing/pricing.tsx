"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useState } from "react";

import { FAMILY_SEATS, PLAN_LIMITS, PLAN_PRICES } from "@/lib/constants";

/**
 * Tarifs, avec bascule mensuel / annuel.
 *
 * En annuel, on affiche le coût mensuel équivalent plutôt que la somme
 * annuelle : c'est la comparaison que l'utilisateur fait dans sa tête, et
 * afficher « 49 € » à côté de « 5,99 € » donnerait l'impression d'un
 * renchérissement.
 */

/**
 * Destination d'un bouton payant.
 *
 * Les réglages portent le sélecteur de paiement. Un visiteur non connecté y
 * est renvoyé vers la connexion par le middleware, qui conserve la formule
 * choisie dans `next` : après connexion, il retombe exactement sur le bouton
 * « Payer » de la formule qu'il avait cliquée, au lieu d'un tableau de bord
 * où il faudrait la rechercher.
 */
function checkoutHref(plan: "pro" | "family", yearly: boolean): string {
  return `/reglages?formule=${plan}&cycle=${yearly ? "yearly" : "monthly"}#formules`;
}

function monthlyEquivalent(yearly: number): string {
  return `${(yearly / 12).toFixed(2).replace(".", ",")} €`;
}

export function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <>
      <div className="mb-8 flex">
        <div
          role="group"
          aria-label="Périodicité de facturation"
          className="inline-flex gap-1 rounded-[10px] border border-[var(--border)] p-1"
        >
          <Toggle active={!yearly} onClick={() => setYearly(false)}>
            Mensuel
          </Toggle>
          <Toggle active={yearly} onClick={() => setYearly(true)}>
            Annuel
            <span className="font-mono text-[11px] text-[var(--positive-light)]">
              −32 %
            </span>
          </Toggle>
        </div>
      </div>

      <div className="grid items-stretch gap-4 md:grid-cols-3">
        <Plan
          name="Gratuit"
          price="0 €"
          suffix="pour toujours"
          features={[
            `${PLAN_LIMITS.free.subscriptions} abonnements suivis`,
            `${PLAN_LIMITS.free.documents} documents`,
            `${PLAN_LIMITS.free.alerts} alertes par mois`,
          ]}
          cta="Commencer"
          href="/login"
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
            "Abonnements, documents et alertes illimités",
            "Recherche en langage courant",
            "Lettres de résiliation illimitées",
          ]}
          cta="Passer Pro"
          href={checkoutHref("pro", yearly)}
          highlight
        />

        <Plan
          name="Premium"
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
            `Jusqu’à ${FAMILY_SEATS - 1} proches invités, chacun son compte`,
            "Idéal en couple ou en famille",
          ]}
          cta="Choisir Premium"
          href={checkoutHref("family", yearly)}
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
      className={`flex items-center gap-2 rounded-[7px] px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--paper)] text-[var(--ink)]"
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
  href,
  highlight,
}: {
  name: string;
  price: string;
  suffix: string;
  note?: string;
  features: string[];
  cta: string;
  href: string;
  highlight?: boolean;
}) {
  const body = (
    <div
      className={`relative flex h-full flex-col rounded-[12px] border p-7 ${
        highlight
          ? "border-[rgba(139,124,240,.55)] bg-[#12111c]"
          : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-[15px] font-semibold">{name}</div>
        {/* « Recommandé » et non « Plus populaire » : sans clients, une
            popularité affichée serait une affirmation inventée. Une
            recommandation, elle, n'engage que nous. */}
        {highlight && (
          <span className="font-mono text-[11px] tracking-[0.06em] text-[var(--accent-lighter)] uppercase">
            Recommandé
          </span>
        )}
      </div>

      <div className="mt-3.5 flex items-baseline gap-1.5">
        <span className="serif text-[52px] leading-none">
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
        href={href}
        className={`h-11 w-full text-sm ${
          highlight ? "btn-primary" : "btn-secondary"
        }`}
      >
        {cta}
      </Link>
    </div>
  );

  return body;
}
