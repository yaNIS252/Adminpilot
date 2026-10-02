"use client";

import Link from "next/link";
import { ExternalLink, Lock, Search, X } from "lucide-react";
import { useState } from "react";

import type { SearchFilters } from "@/lib/ai/schemas";
import { formatAmount, formatDate } from "@/lib/format";

/**
 * Recherche dans les documents, en français courant.
 *
 * Affiche ce qu'elle a compris (catégorie, période, montant) : une recherche
 * qui ne trouve rien sans dire pourquoi laisse croire que le document n'existe
 * pas.
 */

type Result = {
  id: string;
  filename_ai: string | null;
  filename_original: string;
  category: string;
  created_at: string;
  extracted_data: { document_date?: string | null; amount?: number | null; provider?: string | null } | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  facture: "Factures",
  contrat: "Contrats",
  assurance: "Assurance",
  impots: "Impôts",
  banque: "Banque",
  logement: "Logement",
  sante: "Santé",
  vehicule: "Véhicule",
  identite: "Identité",
  travail: "Travail",
  autre: "Autre",
};

const EXAMPLES = ["facture EDF de mars", "fiches de paie 2025", "assurance plus de 50 €"];

function describe(filters: SearchFilters): string[] {
  const parts: string[] = [];
  if (filters.category) parts.push(CATEGORY_LABELS[filters.category] ?? filters.category);
  if (filters.provider) parts.push(filters.provider);
  if (filters.date_from && filters.date_to) {
    parts.push(`du ${formatDate(filters.date_from)} au ${formatDate(filters.date_to)}`);
  } else if (filters.date_from) {
    parts.push(`depuis le ${formatDate(filters.date_from)}`);
  } else if (filters.date_to) {
    parts.push(`jusqu’au ${formatDate(filters.date_to)}`);
  }
  if (filters.amount_min !== null) parts.push(`plus de ${formatAmount(filters.amount_min)}`);
  if (filters.amount_max !== null) parts.push(`moins de ${formatAmount(filters.amount_max)}`);
  if (filters.keywords) parts.push(`« ${filters.keywords} »`);
  return parts;
}

export function DocumentSearch({ locked }: { locked: boolean }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ filters: SearchFilters; documents: Result[]; total: number } | null>(null);

  if (locked) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[var(--border)] bg-[rgba(255,255,255,.02)] px-4 py-3">
        <Search className="size-4 shrink-0 text-[var(--text-faint)]" />
        <span className="min-w-[200px] flex-1 text-sm text-[var(--text-faint)]">
          Rechercher « facture EDF de mars »…
        </span>
        <Link href="/reglages?formule=pro#formules" className="btn-secondary h-9 px-3.5 text-[13px]">
          <Lock className="size-3.5" />
          Recherche avec Pro
        </Link>
      </div>
    );
  }

  async function run(value: string) {
    const text = value.trim();
    if (!text) return;
    setQuery(text);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: text }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) setOutcome(body);
      else
        setError(
          response.status === 429
            ? "Beaucoup de recherches d’un coup : réessaie dans quelques minutes."
            : "La recherche n’a pas abouti. Réessaie.",
        );
    } catch {
      setError("Connexion interrompue. Réessaie.");
    }
    setBusy(false);
  }

  async function open(id: string) {
    const response = await fetch(`/api/docs/${id}`);
    if (!response.ok) return;
    const { url } = await response.json();
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const understood = outcome ? describe(outcome.filters) : [];

  return (
    <div className="flex flex-col gap-3">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          void run(query);
        }}
        className="flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[rgba(255,255,255,.02)] px-3 focus-within:border-[var(--accent)]"
      >
        <Search className="size-4 shrink-0 text-[var(--text-faint)]" />
        <input
          // « text » et non « search » : le champ de recherche natif ajoute sa
          // propre croix, qui vide le texte sans effacer les résultats.
          type="text"
          enterKeyHint="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher « facture EDF de mars », « fiches de paie 2025 »…"
          aria-label="Rechercher dans mes documents"
          maxLength={300}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {outcome && (
          <button
            type="button"
            onClick={() => {
              setOutcome(null);
              setQuery("");
            }}
            aria-label="Effacer la recherche"
            className="grid size-8 place-items-center rounded-lg text-[var(--text-faint)] hover:text-[var(--text)]"
          >
            <X className="size-4" />
          </button>
        )}
        <button type="submit" disabled={busy} className="btn-primary h-8 px-3 text-[13px] disabled:opacity-60">
          {busy ? "…" : "Chercher"}
        </button>
      </form>

      {!outcome && !error && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-faint)]">
          Exemples :
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => void run(example)}
              className="rounded-full border border-[var(--border)] px-2.5 py-1 hover:border-[var(--border-strong)] hover:text-[var(--text)]"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="m-0 text-[13px] text-[var(--danger-light)]">
          {error}
        </p>
      )}

      {outcome && (
        <section aria-live="polite" className="rounded-[var(--radius-xl)] border border-[var(--border)] p-4">
          <div className="mb-2 text-xs text-[var(--text-faint)]">
            {outcome.total === 0 ? "Aucun document" : `${outcome.total} document${outcome.total > 1 ? "s" : ""}`}
            {understood.length > 0 && <> · compris : {understood.join(" · ")}</>}
          </div>
          {outcome.documents.length === 0 ? (
            <p className="m-0 py-4 text-sm text-[var(--text-dim)]">
              Rien ne correspond. Essaie avec moins de mots, ou seulement le nom
              du fournisseur.
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {outcome.documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center gap-3 border-b border-[var(--border-soft)] py-2.5 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {doc.filename_ai ?? doc.filename_original}
                    </div>
                    <div className="text-xs text-[var(--text-faint)]">
                      {[
                        CATEGORY_LABELS[doc.category] ?? doc.category,
                        formatDate(doc.extracted_data?.document_date ?? doc.created_at.slice(0, 10)),
                        typeof doc.extracted_data?.amount === "number"
                          ? formatAmount(doc.extracted_data.amount)
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <button type="button" onClick={() => void open(doc.id)} className="btn-secondary h-8 px-3 text-xs">
                    <ExternalLink className="size-3.5" />
                    Ouvrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
