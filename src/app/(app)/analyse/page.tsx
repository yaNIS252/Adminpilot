import Link from "next/link";
import { ArrowRight, Lock, PiggyBank } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { formatAmount, formatDate, monthlyEquivalent } from "@/lib/format";
import { ANALYSED_CATEGORIES, recommend, telecomKind, type ReferenceOffer } from "@/lib/offers/analysis";
import { SpendSimulator } from "@/components/analyse/spend-simulator";
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
      .select("id, category, kind, provider_name, name, monthly_price, conditions, url, affiliate_url, checked_at, details")
      .eq("active", true)
      .in("category", [...ANALYSED_CATEGORIES])
      .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString().slice(0, 10)}`),
  ]);

  const rows = subs ?? [];
  const locked = !auth || auth.profile.plan === "free";
  const realRecos = recommend(rows, (offerRows ?? []) as ReferenceOffer[]);
  const totalSaving = realRecos.reduce((sum, reco) => sum + reco.yearlySaving, 0);
  // En gratuit, le détail n'est pas seulement flouté : il n'est pas envoyé au
  // navigateur du tout (un flou CSS se retire en deux clics). Des cartes
  // factices donnent la forme, sans aucune donnée réelle.
  const recos = locked
    ? realRecos.map((reco, index) => ({
        ...reco,
        subscription: { ...reco.subscription, id: `masque-${index}`, provider: "ton fournisseur" },
        currentMonthly: 0,
        yearlySaving: 0,
        monthlySaving: 0,
        alternatives: [],
        offer: {
          ...reco.offer,
          id: "masque",
          name: "Offre réservée",
          provider_name: "un autre fournisseur",
          monthly_price: 0,
          conditions: null,
          affiliate_url: null,
        },
      }))
    : realRecos;

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
  const simulated = rows
    .map((sub) => {
      const monthly = monthlyEquivalent(sub.amount, sub.cycle);
      return {
        id: sub.id,
        provider: sub.provider,
        monthly,
        isBox: sub.category === "telecom" && telecomKind(sub, monthly) === "box",
      };
    })
    .sort((a, b) => b.monthly - a.monthly);

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
                  {reco.subscription.provider}.{" "}
                  Moins cher ailleurs :
                </p>
                <ul className="m-0 mt-3 list-none space-y-2 p-0">
                  {[
                    {
                      offer: reco.offer,
                      monthly: reco.currentMonthly - reco.monthlySaving,
                      yearlySaving: reco.yearlySaving,
                      estimated: reco.estimated,
                    },
                    ...reco.alternatives,
                  ].map((option, index) => (
                    <li
                      key={option.offer.id}
                      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-lg)] border p-3 ${
                        index === 0
                          ? "border-[rgb(var(--accent-rgb)/.35)] bg-[rgb(var(--accent-rgb)/.06)]"
                          : "border-[var(--border)]"
                      }`}
                    >
                      <div className="min-w-[12rem] flex-1">
                        <div className="text-sm">
                          <strong>{option.offer.provider_name}</strong>
                          <span className="text-[var(--text-dim)]"> · {option.offer.name}</span>
                          {index === 0 && (
                            <span className="ml-2 rounded-full bg-[rgb(var(--accent-rgb)/.14)] px-1.5 py-px text-[10px] font-medium text-[var(--accent-lighter)]">
                              la moins chère
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--text-faint)]">
                          {option.offer.conditions ? `${option.offer.conditions} · ` : ""}
                          prix vérifié le {formatDate(option.offer.checked_at)} sur le site{" "}
                          {option.offer.affiliate_url ? "(lien partenaire)" : "officiel"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="mono text-sm">
                          {option.estimated ? "≈ " : ""}
                          {formatAmount(option.monthly)}/mois
                        </div>
                        <div className="mono text-xs text-[var(--positive-light)]">
                          {option.estimated ? "≈ " : ""}−{formatAmount(option.yearlySaving)}/an
                        </div>
                      </div>
                      <a
                        href={`/api/go/${option.offer.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary inline-flex h-9 items-center gap-1.5 px-3 text-xs"
                      >
                        Voir l’offre
                        <ArrowRight className="size-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
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

      <SpendSimulator subscriptions={simulated} bundlesUnlocked={!locked} />

      <Link
        href="/bilan"
        className="anim-up flex items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-[var(--border)] px-5 py-4 text-sm no-underline hover:border-[var(--border-strong)]"
      >
        <span>
          <strong className="font-semibold text-[var(--text)]">Bilan annuel</strong>
          <span className="block text-xs text-[var(--text-faint)]">
            Ton année en PDF ou pour Excel (Premium)
          </span>
        </span>
        <ArrowRight className="size-4 text-[var(--text-dim)]" />
      </Link>

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
                <div className="mt-1.5 h-[5px] overflow-hidden rounded-[5px] bg-[rgb(var(--fg-rgb)/.06)]">
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
