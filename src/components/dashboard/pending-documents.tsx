"use client";

import { Check, ExternalLink, FileText, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatAmount, formatDate } from "@/lib/format";

/**
 * Factures jointes à un e-mail d'un expéditeur inconnu (filtre « mots-clés »).
 * Rien n'est rangé sans accord : « Garder » les range, « Ignorer » les
 * supprime, et sans réponse elles disparaissent au bout de 30 jours.
 *
 * Une facture périodique d'un fournisseur pas encore suivi propose ensuite
 * de le suivre comme abonnement.
 */

export type PendingDocument = {
  id: string;
  name: string;
  provider: string | null;
  amount: number | null;
  currency: string;
  date: string | null;
  cycle: string | null;
  pendingUntil: string;
  /** Périodique et fournisseur pas encore suivi : « Suivre comme abonnement ». */
  canTrack: boolean;
};

const PERIODIC = new Set(["monthly", "yearly", "quarterly", "weekly"]);

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function PendingDocuments({ items }: { items: PendingDocument[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Gardés à l'instant et périodiques : on propose le suivi comme abonnement.
  const [kept, setKept] = useState<PendingDocument[]>([]);
  const [tracked, setTracked] = useState<Set<string>>(new Set());

  async function open(id: string) {
    const response = await fetch(`/api/docs/${id}`);
    if (!response.ok) return;
    const { url } = await response.json();
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function keep(item: PendingDocument) {
    setBusy(item.id);
    setError(null);
    const response = await fetch(`/api/docs/${item.id}/keep`, { method: "POST" }).catch(() => null);
    setBusy(null);
    if (response?.ok) {
      if (item.canTrack) setKept((current) => [...current, item]);
      router.refresh();
    } else if (response?.status === 402) {
      setError("Ta formule a atteint sa limite de documents : passe à Pro ou supprime un document pour garder celui-ci.");
    } else {
      setError("Le document n’a pas pu être gardé. Réessaie.");
    }
  }

  async function ignore(item: PendingDocument) {
    setBusy(item.id);
    setError(null);
    const response = await fetch(`/api/docs/${item.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    if (response?.ok) router.refresh();
    else setError("Le document n’a pas pu être ignoré. Réessaie.");
  }

  async function track(item: PendingDocument) {
    if (!item.provider || item.amount === null || !item.cycle || !PERIODIC.has(item.cycle)) return;
    setBusy(item.id);
    setError(null);
    const response = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: item.provider,
        amount: item.amount,
        cycle: item.cycle,
        category: "autre",
        next_renewal: null,
      }),
    }).catch(() => null);
    setBusy(null);
    if (response?.ok || response?.status === 409) {
      setTracked((current) => new Set(current).add(item.id));
      router.refresh();
    } else if (response?.status === 403) {
      setError("Ta formule a atteint sa limite d’abonnements suivis.");
    } else {
      setError("L’abonnement n’a pas pu être ajouté. Réessaie.");
    }
  }

  const suggestions = kept.filter((item) => !tracked.has(item.id));
  if (items.length === 0 && suggestions.length === 0 && !error) return null;

  return (
    <section
      id="en-attente"
      aria-labelledby="en-attente-titre"
      className="anim-up scroll-mt-6 rounded-[var(--radius-xl)] border border-[rgb(var(--accent-rgb)/.35)] bg-[var(--accent-soft)] p-4 sm:p-5"
    >
      {items.length > 0 && (
        <>
          <h2 id="en-attente-titre" className="m-0 text-[15px] font-semibold">
            {items.length === 1 ? "Document en attente" : `${items.length} documents en attente`}
          </h2>
          <p className="m-0 mt-1 text-[13px] text-[var(--text-dim)]">
            Factures reçues d’expéditeurs que tu ne suis pas encore. Garde celles qui
            te concernent : les autres disparaissent seules au bout de 30 jours.
          </p>
          <ul className="m-0 mt-3 list-none space-y-2 p-0">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
              >
                <FileText className="size-5 shrink-0 text-[var(--accent-lighter)]" />
                <div className="min-w-[10rem] flex-1">
                  <div className="text-sm font-medium">{item.provider ?? item.name}</div>
                  <div className="text-xs text-[var(--text-faint)]">
                    {[
                      item.amount !== null ? formatAmount(item.amount, item.currency) : null,
                      item.date ? formatDate(item.date) : null,
                      `supprimé dans ${daysLeft(item.pendingUntil)} j sans réponse`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => void open(item.id)}
                    aria-label={`Ouvrir ${item.name}`}
                    className="btn-secondary h-8 px-2.5 text-xs"
                  >
                    <ExternalLink className="size-3.5" />
                    Voir
                  </button>
                  <button
                    type="button"
                    onClick={() => void keep(item)}
                    disabled={busy === item.id}
                    className="btn-primary h-8 flex-1 px-3 text-xs disabled:opacity-60 sm:flex-none"
                  >
                    <Check className="size-3.5" />
                    Garder
                  </button>
                  <button
                    type="button"
                    onClick={() => void ignore(item)}
                    disabled={busy === item.id}
                    className="btn-secondary h-8 flex-1 px-3 text-xs disabled:opacity-60 sm:flex-none"
                  >
                    <X className="size-3.5" />
                    Ignorer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {suggestions.map((item) => (
        <div
          key={item.id}
          className="mt-3 flex flex-wrap items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px]"
        >
          <span className="min-w-[12rem] flex-1 text-[var(--text-dim)]">
            <strong className="font-medium text-[var(--text)]">{item.provider}</strong> est facturé
            régulièrement. Le suivre comme abonnement ?
          </span>
          <button
            type="button"
            onClick={() => void track(item)}
            disabled={busy === item.id}
            className="btn-primary h-8 px-3 text-xs disabled:opacity-60"
          >
            <Plus className="size-3.5" />
            Suivre comme abonnement
          </button>
          <button
            type="button"
            onClick={() => setTracked((current) => new Set(current).add(item.id))}
            className="text-xs text-[var(--text-faint)] underline hover:text-[var(--text)]"
          >
            Non merci
          </button>
        </div>
      ))}

      {error && (
        <p role="alert" className="m-0 mt-2 text-[13px] text-[var(--danger-light)]">
          {error}{" "}
          {error.includes("Pro") && (
            <Link href="/reglages?formule=pro#formules" className="underline">
              Voir les formules
            </Link>
          )}
        </p>
      )}
    </section>
  );
}
