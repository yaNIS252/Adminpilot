import Link from "next/link";
import { ArrowRight, Lock, PiggyBank } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { formatAmount, formatDate, monthlyEquivalent } from "@/lib/format";
import { ANALYSED_CATEGORIES, recommend, type ReferenceOffer } from "@/lib/offers/analysis";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Analyse — AdminPilot" };

const CATEGORY_LABELS: Record<string, string> = {
  streaming: "Streaming",
  energie: "Énergie",
  telecom: "Box et mobile",
  assurance: "Assurance",
  banque: "Banque",
  transport: "Transport",
  logement: "Logement",
  sante: "Santé",
  logiciel: "Logiciels",
  presse: "Presse",
  sport: "Sport",
  autre: "Autre",
};

/**
 * Analyse des dépenses et changements de fournisseur rentables (énergie, box,
 * mobile, assurance). Le détail est réservé à Pro et Premium ; en gratuit, le
 * total des économies possibles reste visible, les cartes sont floutées.
 */
export default async function AnalysePage() {
  const auth = await requireUser();
  const supabase = await createClient();
  const [{ data: subs }, { data: offerRows }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, provider, amount, cycle, category")
      .eq("status", "active")
      .eq("over_quota", false),
    supabase
      .from("offers")
      .select("id, category, kind, provider_name, name, monthly_price, conditions, url, affiliate_url, checked_at")
      .eq("active", true)
      .in("category", [...ANALYSED_CATEGORIES])
      .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString().slice(0, 10)}`),
  ]);

  const rows = subs ?? [];
  const locked = !auth || auth.profile.plan === "free";
  const recos = recommend(rows, (offerRows ?? []) as ReferenceOffer[]);
  const totalSaving = recos.reduce((sum, reco) => sum + reco.yearlySaving, 0);

  const byCategory = [
    ...rows
      .reduce((map, sub) => {
        const key = sub.category ?? "autre";
        map.set(key, (map.get(key) ?? 0) + monthlyEquivalent(sub.amount, sub.cycle));
        return map;
      }, new Map<string, number>())
      .entries(),
  ]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
  const monthlyTotal = byCategory.reduce((sum, [, amount]) => sum + amount, 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="anim-up">
        <h1 className="serif m-0 text-[36px] leading-[1.05]">Analyse</h1>
        <p className="m-0 mt-1 max-w-xl text-sm text-[var(--text-dim)]">
          Où part ton argent, et ce que tu économiserais en changeant de fournisseur
          pour l’énergie, la box, le mobile et l’assurance.
        </p>
      </header>

      <section className="card-sheen anim-up flex flex-wrap items-center gap-4 rounded-[var(--radius-xl)] border border-[var(--border)] p-5">
        <PiggyBank className="size-6 shrink-0 text-[var(--positive-light)]" />
        <div className="min-w-0 flex-1">
          <div className="text-xs text-[var(--text-faint)]">Économies possibles</div>
          <div className="mono text-[28px] font-semibold">
            {totalSaving > 0 ? `${formatAmount(totalSaving)} par an` : "—"}
          </div>
          <p className="m-0 text-xs text-[var(--text-faint)]">
            {recos.length
              ? `${recos.length} changement${recos.length > 1 ? "s" : ""} possible${recos.length > 1 ? "s" : ""}, à conditions comparables.`
              : "Aucune offre vérifiée nettement moins chère pour l’instant. On compare dès qu’il y en a."}
          </p>
        </div>
      </section>

      {recos.length > 0 && (
        <section className="relative">
          <ul className={`m-0 flex list-none flex-col gap-3 p-0 ${locked ? "pointer-events-none blur-[6px] select-none" : ""}`} aria-hidden={locked}>
            {recos.map((reco) => (
              <li
                key={reco.subscription.id}
                className="card-sheen rounded-[var(--radius-xl)] border border-[var(--border)] p-5"
              >
                <p className="m-0 text-[15px] leading-[1.55]">
                  Tu paies <strong>{formatAmount(reco.currentMonthly)}/mois</strong> chez{" "}
                  {reco.subscription.provider}. Offre <strong>{reco.offer.name}</strong> de{" "}
                  {reco.offer.provider_name} à <strong>{formatAmount(reco.offer.monthly_price)}</strong>{" "}
                  → <strong className="text-[var(--positive-light)]">-{formatAmount(reco.yearlySaving)}/an</strong>
                </p>
                <p className="m-0 mt-2 text-xs text-[var(--text-faint)]">
                  {reco.offer.conditions ? `${reco.offer.conditions} · ` : ""}
                  Prix vérifié le {formatDate(reco.offer.checked_at)} ·{" "}
                  {reco.offer.affiliate_url ? "lien partenaire" : "source officielle"}
                </p>
                <a
                  href={`/api/go/${reco.offer.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary mt-3 inline-flex h-10 items-center gap-1.5 px-4 text-[13px]"
                >
                  Voir l’offre
                  <ArrowRight className="size-4" />
                </a>
              </li>
            ))}
          </ul>
          {locked && (
            <div className="absolute inset-0 grid place-items-center p-4">
              <div className="flex max-w-sm flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-[rgb(var(--accent-rgb)/.35)] bg-[var(--bg-elevated)] p-5 text-center">
                <Lock className="size-5 text-[var(--accent-lighter)]" />
                <p className="m-0 text-sm text-[var(--text-dim)]">
                  Le détail des offres et le lien pour changer sont inclus avec Pro et Premium.
                </p>
                <Link href="/reglages?formule=pro#formules" className="btn-primary h-10 px-4 text-[13px]">
                  Passer Pro
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card-sheen anim-up rounded-[var(--radius-xl)] border border-[var(--border)] p-5">
        <h2 className="mt-0 mb-3 text-[15px] font-semibold">Dépenses par catégorie</h2>
        {byCategory.length ? (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {byCategory.map(([category, amount]) => (
              <li key={category}>
                <div className="flex justify-between text-[13px]">
                  <span className="text-[var(--text-dim)]">{CATEGORY_LABELS[category] ?? category}</span>
                  <span className="mono">{formatAmount(amount)}/mois</span>
                </div>
                <div className="mt-1.5 h-[5px] overflow-hidden rounded-[5px] bg-[rgba(255,255,255,.06)]">
                  <div
                    className="h-full bg-[var(--accent)]"
                    style={{ width: `${Math.max(3, (amount / monthlyTotal) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-[var(--text-faint)]">Aucun abonnement suivi pour l’instant.</p>
        )}
      </section>
    </div>
  );
}
