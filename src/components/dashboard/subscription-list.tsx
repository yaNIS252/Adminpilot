"use client";

import Link from "next/link";
import { Check, LogOut, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

import { ProviderAvatar } from "@/components/shared/provider-avatar";
import { BILLING_CYCLES } from "@/lib/ai/schemas";
import { formatAmount, formatCycle, formatDate } from "@/lib/format";
import type { Subscription } from "@/lib/supabase/types";

/**
 * Liste éditable des abonnements.
 *
 * Toute modification passe par `/api/subscriptions`, qui repose sur RLS :
 * l'interface ne fait jamais autorité sur ce que l'utilisateur a le droit de
 * toucher.
 */
/** Dernier changement de prix d'un abonnement, s'il est récent. */
export type RecentPriceChange = {
  kind: string;
  old_amount: number;
  new_amount: number;
};

export function SubscriptionList({
  initial,
  reviewMode,
  priceChanges = {},
}: {
  initial: Subscription[];
  reviewMode: boolean;
  priceChanges?: Record<string, RecentPriceChange>;
}) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, changes: Record<string, unknown>) {
    setBusy(id);
    setError(null);

    const response = await fetch("/api/subscriptions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...changes }),
    });
    setBusy(null);

    if (!response.ok) {
      setError("La modification n’a pas pu être enregistrée.");
      return;
    }

    const { subscription } = await response.json();

    setItems((current) =>
      // En mode revue, une ligne confirmée n'a plus sa place dans la liste :
      // la laisser donnerait l'impression que rien ne s'est passé.
      reviewMode
        ? current.filter((item) => item.id !== id)
        : current.map((item) => (item.id === id ? subscription : item)),
    );
    setEditing(null);
  }

  async function remove(id: string) {
    setBusy(id);
    const response = await fetch(`/api/subscriptions?id=${id}`, {
      method: "DELETE",
    });
    setBusy(null);

    if (!response.ok) {
      setError("La suppression n’a pas abouti.");
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }

  if (items.length === 0) {
    return (
      <p className="card-sheen rounded-[var(--radius-xl)] border border-[var(--border)] px-4 py-12 text-center text-sm text-[var(--text-faint)]">
        {reviewMode
          ? "Rien à vérifier. Tout est confirmé."
          : "Aucun abonnement détecté pour l’instant. Transfère une facture à ton adresse AdminPilot pour démarrer."}
      </p>
    );
  }

  return (
    <>
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-[var(--radius)] border border-[rgba(240,113,104,.3)] bg-[rgba(240,113,104,.08)] px-4 py-3 text-sm text-[var(--danger-light)]"
        >
          {error}
        </p>
      )}

      <ul className="m-0 list-none space-y-2.5 p-0">
        {items.map((sub) => {
          const uncertain = !sub.confirmed_by_user && sub.confidence < 0.7;

          return (
            <li
              key={sub.id}
              className="card-sheen rounded-[var(--radius-xl)] border border-[var(--border)] p-4 transition-colors hover:border-[rgb(var(--accent-rgb)/.28)]"
            >
              {editing === sub.id ? (
                <EditForm
                  sub={sub}
                  busy={busy === sub.id}
                  onCancel={() => setEditing(null)}
                  onSave={(changes) => patch(sub.id, changes)}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <ProviderAvatar name={sub.provider} size={40} />

                  <div className="min-w-[8rem] flex-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      {sub.provider}
                      {priceChanges[sub.id] && (
                        <PriceBadge change={priceChanges[sub.id]} currency={sub.currency} />
                      )}
                      {uncertain && (
                        <span
                          title="Détecté automatiquement, non vérifié"
                          className="rounded-full bg-[rgba(224,161,56,.15)] px-1.5 text-[10px] font-semibold text-[var(--warning-light)]"
                        >
                          {Math.round(sub.confidence * 100)} %
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-faint)]">
                      {[
                        formatCycle(sub.cycle) || "périodicité inconnue",
                        sub.next_renewal
                          ? `prochaine échéance le ${formatDate(sub.next_renewal)}`
                          : "échéance inconnue",
                      ].join(" · ")}
                    </div>
                  </div>

                  <div className="mono text-right text-lg font-semibold">
                    {formatAmount(sub.amount, sub.currency) ?? "—"}
                  </div>

                  <div className="flex w-full gap-2 sm:w-auto">
                    {reviewMode && (
                      <Action
                        onClick={() => patch(sub.id, { confirmed_by_user: true })}
                        disabled={busy === sub.id}
                        tone="positive"
                        icon={<Check className="size-4" />}
                      >
                        Confirmer
                      </Action>
                    )}
                    <Action
                      onClick={() => setEditing(sub.id)}
                      icon={<Pencil className="size-4" />}
                    >
                      Modifier
                    </Action>
                    {!reviewMode && (
                      <Link
                        href={`/abonnements/${sub.id}/resilier`}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--text-muted)] no-underline transition-colors hover:bg-[rgba(255,255,255,.06)] hover:text-white sm:flex-none"
                      >
                        <LogOut className="size-4" />
                        Résilier
                      </Link>
                    )}
                    <Action
                      onClick={() => remove(sub.id)}
                      disabled={busy === sub.id}
                      tone="danger"
                      icon={<Trash2 className="size-4" />}
                      label="Supprimer"
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function PriceBadge({
  change,
  currency,
}: {
  change: RecentPriceChange;
  currency: string;
}) {
  const up = change.kind === "increase";
  const diff = change.new_amount - change.old_amount;
  return (
    <span
      title={`${formatAmount(change.old_amount, currency)} → ${formatAmount(change.new_amount, currency)}`}
      className={`rounded-full px-1.5 text-[10px] font-semibold ${
        up
          ? "bg-[rgba(224,161,56,.15)] text-[var(--warning-light)]"
          : "bg-[rgba(63,207,149,.12)] text-[var(--positive-light)]"
      }`}
    >
      {up ? "↑ +" : "↓ "}
      {formatAmount(diff, currency)}
    </span>
  );
}

function Action({
  onClick,
  disabled,
  tone = "neutral",
  icon,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "positive" | "danger";
  icon: React.ReactNode;
  /** Utilisé quand le bouton n'affiche que son icône. */
  label?: string;
  children?: React.ReactNode;
}) {
  const tones = {
    neutral:
      "border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[rgba(255,255,255,.06)] hover:text-white",
    positive:
      "border-[rgba(63,207,149,.35)] text-[var(--positive-light)] hover:bg-[rgba(63,207,149,.12)]",
    danger:
      "border-[rgba(240,113,104,.3)] text-[var(--danger-light)] hover:bg-[rgba(240,113,104,.12)]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${tones[tone]} ${children ? "flex-1 sm:flex-none" : ""}`}
    >
      {icon}
      {children}
    </button>
  );
}

function EditForm({
  sub,
  busy,
  onCancel,
  onSave,
}: {
  sub: Subscription;
  busy: boolean;
  onCancel: () => void;
  onSave: (changes: Record<string, unknown>) => void;
}) {
  const [provider, setProvider] = useState(sub.provider);
  const [amount, setAmount] = useState(sub.amount?.toString() ?? "");
  const [cycle, setCycle] = useState(sub.cycle);
  const [renewal, setRenewal] = useState(sub.next_renewal ?? "");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          provider,
          // Champ vidé = information absente, pas zéro. Un abonnement à 0 €
          // et un abonnement dont on ignore le montant sont deux choses
          // différentes.
          amount: amount === "" ? null : Number(amount.replace(",", ".")),
          cycle,
          next_renewal: renewal === "" ? null : renewal,
        });
      }}
      className="space-y-3"
    >
      <Field label="Fournisseur">
        <input
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
          required
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Montant">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="13,49"
            className="mono w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
        </Field>
        <Field label="Périodicité">
          <select
            value={cycle}
            onChange={(event) =>
              setCycle(event.target.value as Subscription["cycle"])
            }
            className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
          >
            {BILLING_CYCLES.map((value) => (
              <option key={value} value={value} className="bg-[var(--bg-elevated)]">
                {formatCycle(value) || "inconnue"}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Prochaine échéance">
        <input
          type="date"
          value={renewal}
          onChange={(event) => setRenewal(event.target.value)}
          className="mono w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
        />
      </Field>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="btn-primary h-10 px-4 text-sm disabled:opacity-60"
        >
          <Check className="size-4" />
          {busy ? "…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-4 py-2.5 text-sm text-[var(--text-muted)] hover:bg-[rgba(255,255,255,.06)]"
        >
          <X className="size-4" />
          Annuler
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-[var(--text-faint)]">
        {label}
      </span>
      {children}
    </label>
  );
}
