"use client";

import { Music, Shield, Tv, Wifi, Zap } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Flux de détections flottant à côté de l'aperçu produit.
 *
 * C'est l'animation signature de la page : trois cartes empilées qui défilent
 * toutes les 2,4 secondes, et qui racontent ce que fait le produit mieux
 * qu'un paragraphe. La carte du dessus entre en fondu, les deux suivantes
 * s'estompent — l'œil suit naturellement la plus nette.
 *
 * Les montants sont cohérents avec l'aperçu voisin : un visiteur qui compare
 * les deux ne doit pas tomber sur des chiffres contradictoires.
 */

const ITEMS = [
  {
    Icon: Tv,
    from: "#e50914",
    to: "#3a0306",
    name: "Netflix",
    sub: "Abonnement détecté",
    amount: "13,49 €/mois",
  },
  {
    Icon: Zap,
    from: "#2f7df6",
    to: "#0b2a6b",
    name: "EDF",
    sub: "Échéance dans 18 jours",
    amount: "86,89 €",
  },
  {
    Icon: Music,
    from: "#1ed760",
    to: "#0a5a28",
    name: "Spotify",
    sub: "Hausse de tarif repérée",
    amount: "11,99 €/mois",
  },
  {
    Icon: Wifi,
    from: "#e2231a",
    to: "#5c0c08",
    name: "Free Mobile",
    sub: "Contrat classé",
    amount: "19,99 €/mois",
  },
  {
    Icon: Shield,
    from: "#e0a138",
    to: "#5a3a06",
    name: "MAIF",
    sub: "Reconduction tacite · loi Hamon",
    amount: "384,00 €/an",
  },
] as const;

export function DetectionFeed() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Respecte le réglage système : quelqu'un qui demande moins de mouvement
    // garde les cartes, mais elles cessent de défiler.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const timer = setInterval(() => setTick((value) => value + 1), 2400);
    return () => clearInterval(timer);
  }, []);

  // Trois cartes visibles, la plus récente en bas de la pile rendue.
  const visible = [0, 1, 2]
    .map((offset) => ({
      item: ITEMS[(tick + offset) % ITEMS.length],
      key: tick + offset,
    }))
    .reverse();

  return (
    <div
      aria-hidden
      className="
        anim-float relative z-[2] mx-auto mt-6 flex w-full max-w-[320px] flex-col items-stretch gap-2.5
        lg:absolute lg:top-[90px] lg:-right-10 lg:mt-0 lg:w-auto lg:max-w-none
      "
    >
      {visible.map(({ item, key }, index) => {
        const { Icon } = item;
        const isNewest = index === 2;

        return (
          <div
            key={key}
            className={`flex w-full items-center lg:w-[270px] gap-[11px] rounded-[14px] border border-[rgba(255,255,255,.12)] bg-[rgba(22,22,32,.72)] py-[11px] pr-3.5 pl-[11px] text-left shadow-[0_20px_50px_-20px_rgba(0,0,0,.9)] backdrop-blur-lg ${
              isNewest ? "anim-in" : ""
            }`}
            style={{ opacity: index === 0 ? 0.55 : index === 1 ? 0.85 : 1 }}
          >
            <span
              className="grid size-[34px] shrink-0 place-items-center rounded-[10px] text-white"
              style={{
                background: `linear-gradient(135deg,${item.from},${item.to})`,
              }}
            >
              <Icon className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                {item.name}
                <span className="size-1.5 rounded-full bg-[var(--positive)] shadow-[0_0_6px_var(--positive)]" />
              </div>
              <div className="truncate text-[11px] text-[var(--text-faint)]">
                {item.sub}
              </div>
            </div>

            <div className="mono shrink-0 text-xs font-semibold text-[var(--text)]">
              {item.amount}
            </div>
          </div>
        );
      })}
    </div>
  );
}
