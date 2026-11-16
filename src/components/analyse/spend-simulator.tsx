"use client";

import { useMemo, useState } from "react";
import { Calculator, ExternalLink, Layers, Lock, Plus, X } from "lucide-react";
import Link from "next/link";

import { formatAmount, formatDate } from "@/lib/format";
import { BUNDLES, type Bundle } from "@/lib/offers/bundles";

export type SimSubscription = {
  id: string;
  provider: string;
  monthly: number;
  /** Box internet (télécom hors mobile), pour les offres box groupées. */
  isBox: boolean;
};

type Extra = { id: string; name: string; monthly: number; bundleId?: string };

const eur = (value: number) => formatAmount(value) ?? "—";

/**
 * Simulateur : « et si je gardais ceci, arrêtais cela, prenais autre chose ? »
 *
 * Rien n'est enregistré : on coche les abonnements gardés, on ajoute des
 * abonnements envisagés, et le total mensuel et annuel se met à jour. Les
 * offres groupées (box avec streaming, Canal+ avec Netflix…) qui couvrent des
 * services payés à part sont proposées et s'essaient en un clic.
 */
export function SpendSimulator({
  subscriptions,
  bundlesUnlocked,
}: {
  subscriptions: SimSubscription[];
  bundlesUnlocked: boolean;
}) {
  const [kept, setKept] = useState<Set<string>>(() => new Set(subscriptions.map((sub) => sub.id)));
  const [extras, setExtras] = useState<Extra[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  const currentMonthly = subscriptions.reduce((sum, sub) => sum + sub.monthly, 0);
  const simulatedMonthly =
    subscriptions.filter((sub) => kept.has(sub.id)).reduce((sum, sub) => sum + sub.monthly, 0) +
    extras.reduce((sum, extra) => sum + extra.monthly, 0);
  const delta = simulatedMonthly - currentMonthly;

  const suggestions = useMemo(
    () =>
      BUNDLES.map((bundle) => {
        const covered = subscriptions.filter(
          (sub) => kept.has(sub.id) && coveredBy(bundle, sub),
        );
        const coveredMonthly = covered.reduce((sum, sub) => sum + sub.monthly, 0);
        return { bundle, covered, saving: coveredMonthly - bundle.monthly };
      })
        .filter(
          ({ bundle, covered }) =>
            covered.length > 0 && !extras.some((extra) => extra.bundleId === bundle.id),
        )
        .sort((a, b) => b.saving - a.saving),
    [subscriptions, kept, extras],
  );

  function toggle(id: string) {
    setKept((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addExtra(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(price.replace(",", "."));
    if (!name.trim() || !Number.isFinite(amount) || amount <= 0) return;
    setExtras((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        monthly: cycle === "yearly" ? amount / 12 : amount,
      },
    ]);
    setName("");
    setPrice("");
  }

  function tryBundle(bundle: Bundle, covered: SimSubscription[]) {
    setExtras((list) => [
      ...list,
      { id: crypto.randomUUID(), name: bundle.name, monthly: bundle.monthly, bundleId: bundle.id },
    ]);
    setKept((previous) => {
      const next = new Set(previous);
      for (const sub of covered) next.delete(sub.id);
      return next;
    });
  }

  function removeExtra(extra: Extra) {
    setExtras((list) => list.filter((item) => item.id !== extra.id));
    // Retirer une offre groupée essayée remet les abonnements qu'elle couvrait.
    if (extra.bundleId) {
      const bundle = BUNDLES.find((item) => item.id === extra.bundleId);
      if (bundle) {
        setKept((previous) => {
          const next = new Set(previous);
          for (const sub of subscriptions) if (coveredBy(bundle, sub)) next.add(sub.id);
          return next;
        });
      }
    }
  }

  function reset() {
    setKept(new Set(subscriptions.map((sub) => sub.id)));
    setExtras([]);
  }

  const field =
    "h-10 min-w-0 rounded-[8px] border border-[var(--border)] bg-[rgb(var(--fg-rgb)/.03)] px-3 text-sm outline-none focus:border-[var(--accent)]";

  return (
    <section className="card-sheen anim-up rounded-[var(--radius-xl)] border border-[var(--border)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="m-0 flex items-center gap-2 text-[15px] font-semibold">
            <Calculator className="size-4 text-[var(--accent-light)]" />
            Simulateur
          </h2>
          <p className="m-0 mt-1 text-[13px] text-[var(--text-dim)]">
            Décoche ce que tu arrêterais, ajoute ce que tu envisages : rien n’est enregistré.
          </p>
        </div>
        {(extras.length > 0 || kept.size !== subscriptions.length) && (
          <button type="button" onClick={reset} className="btn-secondary h-8 px-3 text-xs">
            Réinitialiser
          </button>
        )}
      </div>

      {/* Résultat */}
      <div className="mt-4 grid gap-3 rounded-[var(--radius-lg)] bg-[rgb(var(--fg-rgb)/.03)] p-4 sm:grid-cols-3">
        <Figure label="Aujourd’hui" monthly={currentMonthly} />
        <Figure label="Avec la simulation" monthly={simulatedMonthly} />
        <div>
          <div className="text-xs text-[var(--text-faint)]">Différence</div>
          <div
            className={`mono text-[20px] font-semibold ${
              delta < -0.005
                ? "text-[var(--positive-light)]"
                : delta > 0.005
                  ? "text-[var(--warning-light)]"
                  : ""
            }`}
          >
            {delta > 0.005 ? "+" : delta < -0.005 ? "−" : ""}
            {eur(Math.abs(delta))}/mois
          </div>
          <div className="mono text-xs text-[var(--text-dim)]">
            {delta > 0.005 ? "+" : delta < -0.005 ? "−" : ""}
            {eur(Math.abs(delta) * 12)}/an
          </div>
        </div>
      </div>

      {/* 1. Abonnements actuels */}
      <h3 className="mt-5 mb-2 text-[13px] font-semibold text-[var(--text-dim)]">
        1. Tes abonnements
      </h3>
      {subscriptions.length ? (
        <ul className="m-0 list-none p-0">
          {subscriptions.map((sub) => (
            <li key={sub.id} className="border-b border-[var(--border-soft)] last:border-b-0">
              <label className="flex cursor-pointer items-center gap-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={kept.has(sub.id)}
                  onChange={() => toggle(sub.id)}
                  className="size-4 shrink-0 accent-[var(--accent)]"
                />
                <span
                  className={`min-w-0 flex-1 truncate ${kept.has(sub.id) ? "" : "text-[var(--text-faint)] line-through"}`}
                >
                  {sub.provider}
                </span>
                <span className="mono shrink-0 text-[13px] text-[var(--text-dim)]">
                  {eur(sub.monthly)}/mois
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-[var(--text-faint)]">Aucun abonnement suivi pour l’instant.</p>
      )}

      {/* 2. Ajouts envisagés */}
      <h3 className="mt-5 mb-2 text-[13px] font-semibold text-[var(--text-dim)]">
        2. Ajouter en prévision
      </h3>
      {extras.length > 0 && (
        <ul className="m-0 mb-3 list-none p-0">
          {extras.map((extra) => (
            <li
              key={extra.id}
              className="flex items-center gap-3 border-b border-[var(--border-soft)] py-2 text-sm last:border-b-0"
            >
              <span className="rounded-full bg-[rgb(var(--accent-rgb)/.14)] px-1.5 py-px text-[10px] font-medium text-[var(--accent-lighter)]">
                prévision
              </span>
              <span className="min-w-0 flex-1 truncate">{extra.name}</span>
              <span className="mono shrink-0 text-[13px] text-[var(--text-dim)]">
                {eur(extra.monthly)}/mois
              </span>
              <button
                type="button"
                onClick={() => removeExtra(extra)}
                aria-label={`Retirer ${extra.name}`}
                className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--text-faint)] hover:bg-[rgb(var(--fg-rgb)/.06)] hover:text-[var(--text)]"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={addExtra} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_7rem_8rem_auto]">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex. : Spotify Famille"
          maxLength={60}
          aria-label="Nom de l’abonnement envisagé"
          className={`${field} col-span-2 sm:col-span-1`}
        />
        <input
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          inputMode="decimal"
          placeholder="Prix €"
          aria-label="Prix"
          className={field}
        />
        <select
          value={cycle}
          onChange={(event) => setCycle(event.target.value as "monthly" | "yearly")}
          aria-label="Périodicité"
          className={field}
        >
          <option value="monthly" className="bg-[var(--bg-elevated)]">par mois</option>
          <option value="yearly" className="bg-[var(--bg-elevated)]">par an</option>
        </select>
        <button type="submit" className="btn-secondary col-span-2 h-10 px-4 text-[13px] sm:col-span-1">
          <Plus className="size-4" />
          Ajouter
        </button>
      </form>

      {/* 3. Offres groupées */}
      <h3 className="mt-5 mb-1 flex items-center gap-2 text-[13px] font-semibold text-[var(--text-dim)]">
        <Layers className="size-3.5" />
        3. Offres qui regroupent plusieurs abonnements
      </h3>
      {!bundlesUnlocked ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-[rgb(var(--accent-rgb)/.35)] p-3 text-[13px] text-[var(--text-dim)]">
          <Lock className="size-4 shrink-0 text-[var(--accent-lighter)]" />
          <span className="min-w-0 flex-1">
            Box avec Netflix et Disney+, Canal+ avec Netflix, banque avec abonnements inclus :
            les offres groupées adaptées à tes abonnements sont incluses avec Pro et Premium.
          </span>
          <Link href="/reglages?formule=pro#formules" className="btn-primary h-9 px-3 text-xs">
            Passer Pro
          </Link>
        </div>
      ) : suggestions.length === 0 ? (
        <p className="m-0 mt-1 text-[13px] text-[var(--text-faint)]">
          Aucune offre groupée connue ne couvre les abonnements cochés.
        </p>
      ) : (
        <ul className="m-0 mt-2 flex list-none flex-col gap-3 p-0">
          {suggestions.map(({ bundle, covered, saving }) => (
            <li key={bundle.id} className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <strong className="text-sm">{bundle.name}</strong>
                <span className="mono text-sm">
                  {eur(bundle.monthly)}/mois
                  {bundle.later && (
                    <span className="text-xs text-[var(--text-faint)]">
                      {" "}puis {eur(bundle.later.monthly)} après {bundle.later.afterMonths} mois
                    </span>
                  )}
                </span>
              </div>
              <p className="m-0 mt-1.5 text-[13px] text-[var(--text-dim)]">
                Comprend : {bundle.includes.map((service) => service.label).join(", ")}.
              </p>
              <p className="m-0 mt-1 text-[13px] text-[var(--text-dim)]">
                Remplacerait : {covered.map((sub) => `${sub.provider} (${eur(sub.monthly)})`).join(", ")}
                {" → "}
                <strong
                  className={
                    saving >= 0.005
                      ? "text-[var(--positive-light)]"
                      : saving <= -0.005
                        ? "text-[var(--warning-light)]"
                        : ""
                  }
                >
                  {saving >= 0.005
                    ? `−${eur(saving)}/mois, soit −${eur(saving * 12)}/an`
                    : saving <= -0.005
                      ? `+${eur(-saving)}/mois par rapport à aujourd’hui`
                      : "même prix qu’aujourd’hui"}
                </strong>
              </p>
              <p className="m-0 mt-1 text-xs text-[var(--text-faint)]">
                {bundle.conditions ? `${bundle.conditions} · ` : ""}Prix relevé le {formatDate(bundle.checkedAt)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => tryBundle(bundle, covered)}
                  className="btn-secondary h-9 px-3 text-xs"
                >
                  Essayer dans la simulation
                </button>
                <a
                  href={bundle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1 px-2 text-xs"
                >
                  Voir l’offre
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 mt-4 text-xs text-[var(--text-faint)]">
        Montants ramenés au mois. Un abonnement inclus dans un autre (Netflix compris dans ton
        Canal+, par exemple) : décoche-le ici, ou mets son montant à 0 dans sa fiche pour qu’il ne
        compte plus nulle part.
      </p>
    </section>
  );
}

function coveredBy(bundle: Bundle, sub: SimSubscription): boolean {
  return bundle.includes.some((service) =>
    service.box ? sub.isBox : service.match.test(sub.provider),
  );
}

function Figure({ label, monthly }: { label: string; monthly: number }) {
  return (
    <div>
      <div className="text-xs text-[var(--text-faint)]">{label}</div>
      <div className="mono text-[20px] font-semibold">{eur(monthly)}/mois</div>
      <div className="mono text-xs text-[var(--text-dim)]">{eur(monthly * 12)}/an</div>
    </div>
  );
}
