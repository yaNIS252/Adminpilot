import { ExternalLink, Scale } from "lucide-react";

import { formatAmount, formatDate } from "@/lib/format";
import { PUBLIC_COMPARATORS, type ComparedOffer } from "@/lib/offers";

/**
 * « Moins cher ailleurs ? » — offres du catalogue moins chères que
 * l'abonnement en cours, et comparateur public gratuit quand il en existe un.
 */
export function OfferList({
  offers,
  category,
}: {
  offers: ComparedOffer[];
  category: string | null;
}) {
  const official = category ? PUBLIC_COMPARATORS[category] : undefined;
  if (offers.length === 0 && !official) return null;

  return (
    <section className="card-sheen anim-up rounded-[var(--radius-xl)] border border-[var(--border)] p-5">
      <h2 className="mt-0 mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <Scale className="size-4 text-[var(--accent-light)]" />
        Moins cher ailleurs ?
      </h2>

      {offers.length > 0 && (
        <ul className="m-0 list-none p-0">
          {offers.map((offer) => (
            <li
              key={offer.id}
              className="flex flex-wrap items-center gap-3 border-b border-[var(--border-soft)] py-2.5 last:border-b-0"
            >
              <div className="min-w-[12rem] flex-1">
                <div className="text-sm font-medium">
                  {offer.provider_name} · {offer.name}
                  {offer.sponsored && (
                    <span className="ml-2 rounded-full bg-[rgba(255,255,255,.06)] px-1.5 py-px text-[10px] font-medium text-[var(--text-faint)]">
                      lien partenaire
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--text-faint)]">
                  {[offer.conditions, `prix relevé le ${formatDate(offer.checked_at)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <span className="mono text-sm">{formatAmount(offer.monthly_price)}/mois</span>
              <span className="mono min-w-[7rem] text-right text-[13px] text-[var(--positive-light)]">
                −{formatAmount(offer.yearlySaving)}/an
              </span>
              <a
                href={`/api/go/${offer.id}`}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="btn-secondary h-8 px-3 text-xs"
              >
                Voir l’offre
                <ExternalLink className="size-3.5" />
              </a>
            </li>
          ))}
        </ul>
      )}

      {official && (
        <p className="m-0 mt-3 text-[13px] text-[var(--text-dim)]">
          Pour comparer toutes les offres du marché :{" "}
          <a href={official.url} target="_blank" rel="noopener noreferrer">
            {official.label}
          </a>
          , gratuit et indépendant.
        </p>
      )}

      {offers.length > 0 && (
        <p className="m-0 mt-3 text-xs text-[var(--text-faint)]">
          Classement par prix mensuel uniquement.{" "}
          {offers.some((offer) => offer.sponsored)
            ? "Un « lien partenaire » peut rapporter une commission à AdminPilot, sans surcoût pour toi et sans effet sur le classement."
            : "Aucun de ces liens ne rapporte de commission à AdminPilot."}{" "}
          Vérifie les conditions (engagement, frais de mise en service) avant de
          changer.
        </p>
      )}
    </section>
  );
}
