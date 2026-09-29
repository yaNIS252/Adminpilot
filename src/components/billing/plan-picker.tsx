"use client";

import { ArrowRight, CircleAlert } from "lucide-react";
import { useState } from "react";

import { FAMILY_SEATS, PLAN_PRICES } from "@/lib/constants";

/**
 * Choix d'une formule payante et passage au paiement.
 *
 * Arrive pré-réglé quand l'utilisateur vient de la page de tarifs : la formule
 * et la périodicité cliquées là-bas sont transmises par l'URL, pour qu'il n'ait
 * plus qu'à confirmer.
 */

type Plan = "pro" | "family";
type Cycle = "monthly" | "yearly";

const PLANS: Record<Plan, { label: string; pitch: string }> = {
  pro: {
    label: "Pro",
    pitch: "Tout illimité, recherche et lettres de résiliation.",
  },
  family: {
    label: "Famille",
    pitch: `Tout le Pro, pour ${FAMILY_SEATS} membres du foyer.`,
  },
};

function price(plan: Plan, cycle: Cycle): string {
  const value = PLAN_PRICES[plan][cycle];
  return `${value.toFixed(value % 1 === 0 ? 0 : 2).replace(".", ",")} €`;
}

export function PlanPicker({
  initialPlan,
  initialCycle,
  cancelled,
}: {
  initialPlan: Plan;
  initialCycle: Cycle;
  /** Retour d'un paiement abandonné. */
  cancelled: boolean;
}) {
  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [cycle, setCycle] = useState<Cycle>(initialCycle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, cycle }),
      });
      const body = await response.json().catch(() => ({}));

      if (response.ok && body.url) {
        // Navigation pleine page : Stripe Checkout refuse d'être affiché dans
        // un cadre, et l'utilisateur doit voir l'adresse stripe.com.
        window.location.assign(body.url);
        return;
      }

      setError(
        body.code === "billing_not_configured"
          ? "Le paiement n’est pas encore ouvert. Réessaie un peu plus tard."
          : "Impossible d’ouvrir la page de paiement. Réessaie dans un instant.",
      );
    } catch {
      setError("Connexion interrompue. Vérifie ton réseau et réessaie.");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {cancelled && (
        <p className="m-0 text-sm text-[var(--text-dim)]">
          Paiement abandonné, rien n’a été débité. Ton choix est conservé
          ci-dessous.
        </p>
      )}

      <div
        role="radiogroup"
        aria-label="Périodicité"
        className="inline-flex gap-1 self-start rounded-[10px] border border-[var(--border)] p-1"
      >
        {(
          [
            ["monthly", "Mensuel"],
            ["yearly", "Annuel"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={cycle === value}
            onClick={() => setCycle(value)}
            className={`rounded-[7px] px-4 py-2 text-sm font-medium transition-colors ${
              cycle === value
                ? "bg-[var(--paper)] text-[var(--ink)]"
                : "text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label="Formule" className="grid gap-2.5 sm:grid-cols-2">
        {(Object.keys(PLANS) as Plan[]).map((value) => {
          const selected = plan === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPlan(value)}
              className={`rounded-[10px] border p-4 text-left transition-colors ${
                selected
                  ? "border-[rgba(139,124,240,.6)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] hover:border-[var(--border-strong)]"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-semibold">
                  {PLANS[value].label}
                </span>
                <span className="mono text-sm">
                  {price(value, cycle)}
                  <span className="text-[var(--text-faint)]">
                    {cycle === "monthly" ? "/mois" : "/an"}
                  </span>
                </span>
              </div>
              <p className="m-0 mt-1.5 text-[13px] leading-[1.5] text-[var(--text-dim)]">
                {PLANS[value].pitch}
              </p>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="btn-primary h-11 self-start px-5 text-sm disabled:opacity-60"
      >
        {busy
          ? "Ouverture du paiement…"
          : `Payer ${price(plan, cycle)} — ${PLANS[plan].label}`}
        {!busy && <ArrowRight className="size-4" />}
      </button>

      <p className="m-0 text-xs text-[var(--text-faint)]">
        Paiement sécurisé par Stripe. Sans engagement : résiliable à tout moment
        depuis cette page. TVA non applicable, art. 293 B du CGI.
      </p>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[8px] border border-[rgba(240,113,104,.3)] bg-[rgba(240,113,104,.08)] px-3.5 py-3 text-[13px] text-[var(--danger-light)]"
        >
          <CircleAlert className="mt-px size-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

/** Accès au portail Stripe pour un abonné : changer de formule, résilier. */
export function ManageSubscription() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      // Même route que le paiement : pour un abonné, elle ouvre le portail.
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.url) {
        window.location.assign(body.url);
        return;
      }
      setError("Impossible d’ouvrir la gestion de l’abonnement pour l’instant.");
    } catch {
      setError("Connexion interrompue. Réessaie.");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="btn-secondary h-10 self-start px-4 text-sm disabled:opacity-60"
      >
        {busy ? "Ouverture…" : "Gérer mon abonnement"}
      </button>
      <p className="m-0 text-xs text-[var(--text-faint)]">
        Changer de formule, mettre à jour ta carte, télécharger tes factures ou
        résilier.
      </p>
      {error && (
        <p role="alert" className="m-0 text-xs text-[var(--danger-light)]">
          {error}
        </p>
      )}
    </div>
  );
}
