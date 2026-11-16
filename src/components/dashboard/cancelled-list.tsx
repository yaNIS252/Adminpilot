"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronDown, ExternalLink, RotateCcw, Search } from "lucide-react";
import { useState } from "react";

import { formatAmount, formatDate } from "@/lib/format";

/**
 * Abonnements résiliés : gardés à part plutôt que supprimés, pour voir ce
 * que les résiliations rapportent et reprendre le suivi d'un abonnement
 * auquel on se réabonne.
 *
 * Se réabonner se fait en deux temps : le site du fournisseur s'ouvre, puis
 * l'utilisateur confirme ici. Entre les deux, l'e-mail de réabonnement qui
 * arriverait est rattaché à la même ligne (voir l'ingestion) : jamais de
 * doublon.
 */

export type CancelledSubscription = {
  id: string;
  provider: string;
  monthly: number;
  cancelledAt: string | null;
  effectiveDate: string | null;
  viaEmail: boolean;
  /** Espace client ou site du fournisseur, s'il est connu. */
  siteUrl: string | null;
  /** Parti se réabonner, pas encore confirmé. */
  resubscribing: boolean;
};

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Au-delà, la liste se replie et se filtre par nom. */
const COLLAPSE_AFTER = 5;

/** Comparaison sans accents ni majuscules (« canal » trouve « Canal+ »). */
const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function CancelledList({ items }: { items: CancelledSubscription[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const collapsible = items.length > COLLAPSE_AFTER;
  const visible = query.trim()
    ? items.filter((item) => normalize(item.provider).includes(normalize(query.trim())))
    : items;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<Set<string>>(
    () => new Set(items.filter((item) => item.resubscribing).map((item) => item.id)),
  );

  function goResubscribe(item: CancelledSubscription) {
    if (!item.siteUrl) return;
    // Ouvert pendant le clic : un onglet ouvert après un `await` serait
    // bloqué par le navigateur.
    window.open(item.siteUrl, "_blank", "noopener,noreferrer");
    setStarted((current) => new Set(current).add(item.id));
    void fetch("/api/subscriptions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id, resubscribing: true }),
    }).catch(() => null);
  }

  async function resume(id: string) {
    setBusy(id);
    setError(null);
    const response = await fetch("/api/subscriptions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status: "active" }),
    }).catch(() => null);
    setBusy(null);
    if (response?.ok) router.refresh();
    else setError("Le suivi n’a pas pu reprendre. Réessaie.");
  }

  const list = (
    <>
      {visible.length === 0 && (
        <p className="m-0 py-2 text-[13px] text-[var(--text-faint)]">
          Aucun abonnement résilié ne correspond à « {query.trim()} ».
        </p>
      )}
      <ul className="m-0 list-none p-0">
        {visible.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--border-soft)] py-2.5 last:border-b-0"
          >
            <div className="min-w-[10rem] flex-1">
              <div className="text-sm font-medium">{item.provider}</div>
              <div className="text-xs text-[var(--text-faint)]">
                {[
                  item.cancelledAt ? `résilié le ${formatDate(item.cancelledAt.slice(0, 10))}` : "résilié",
                  item.effectiveDate ? `accès jusqu’au ${formatDate(item.effectiveDate)}` : null,
                  item.viaEmail ? "confirmé par e-mail" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            {item.monthly > 0 && (
              <span className="mono text-[13px] text-[var(--positive-light)]">
                −{formatAmount(item.monthly)}/mois
              </span>
            )}
            {started.has(item.id) ? (
              <div className="flex w-full flex-wrap items-center gap-2 rounded-[8px] bg-[rgb(var(--accent-rgb)/.08)] px-3 py-2 text-[13px] sm:w-auto">
                <span className="text-[var(--text-dim)]">Réabonné sur le site ?</span>
                <button
                  type="button"
                  onClick={() => resume(item.id)}
                  disabled={busy === item.id}
                  className="btn-primary h-8 px-3 text-xs disabled:opacity-60"
                >
                  <Check className="size-3.5" />
                  Oui, reprendre le suivi
                </button>
                {item.siteUrl && (
                  <a
                    href={item.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--text-faint)] underline hover:text-[var(--text)]"
                  >
                    Rouvrir {hostLabel(item.siteUrl)}
                  </a>
                )}
              </div>
            ) : item.siteUrl ? (
              <button
                type="button"
                onClick={() => goResubscribe(item)}
                aria-label={`Se réabonner sur ${hostLabel(item.siteUrl)} (nouvel onglet)`}
                className="btn-secondary h-8 px-3 text-xs"
              >
                <ExternalLink className="size-3.5" />
                Se réabonner
              </button>
            ) : (
              <button
                type="button"
                onClick={() => resume(item.id)}
                disabled={busy === item.id}
                className="btn-secondary h-8 px-3 text-xs disabled:opacity-60"
              >
                <RotateCcw className="size-3.5" />
                Je me suis réabonné
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="m-0 mt-2 text-[13px] text-[var(--danger-light)]">
          {error}
        </p>
      )}
    </>
  );

  if (!collapsible) return list;

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-[8px] py-1 text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text)] [&::-webkit-details-marker]:hidden">
        Voir les {items.length} abonnements résiliés
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <label className="mt-3 mb-1 flex h-10 items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[rgb(var(--fg-rgb)/.03)] px-3 focus-within:border-[var(--accent)]">
        <Search className="size-4 shrink-0 text-[var(--text-faint)]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un abonnement"
          aria-label="Rechercher un abonnement résilié"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      {list}
    </details>
  );
}
