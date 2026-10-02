"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, Users } from "lucide-react";
import { useState } from "react";

import { FAMILY_SEATS, PLAN_LABELS, PLAN_PRICES } from "@/lib/constants";

/**
 * Choix d'une formule payante.
 *
 * Deux usages :
 *  · `checkout` — compte gratuit : ouvre le paiement Stripe. Arrive pré-réglé
 *    quand l'utilisateur vient de la page de tarifs, la formule et la
 *    périodicité cliquées là-bas étant transmises par l'URL ;
 *  · `switch` — abonné : change de formule sur place, au prorata.
 */

type Plan = "pro" | "family";
type Cycle = "monthly" | "yearly";

const PITCH: Record<Plan, string> = {
  pro: "Tout illimité, recherche et lettres de résiliation.",
  family: `Tout le Pro, et jusqu’à ${FAMILY_SEATS - 1} proches invités avec chacun son compte. Idéal en couple ou en famille.`,
};

export function formatPrice(plan: Plan, cycle: Cycle): string {
  const value = PLAN_PRICES[plan][cycle];
  return `${value.toFixed(value % 1 === 0 ? 0 : 2).replace(".", ",")} €`;
}

export function PlanPicker({
  mode = "checkout",
  initialPlan,
  initialCycle,
  cancelled = false,
  current,
  householdSize = 0,
}: {
  mode?: "checkout" | "switch";
  initialPlan: Plan;
  initialCycle: Cycle;
  /** Retour d'un paiement abandonné. */
  cancelled?: boolean;
  /** Formule en cours, en mode `switch`. */
  current?: { plan: Plan; cycle: Cycle };
  /** Membres ayant rejoint le foyer, pour prévenir avant de le dissoudre. */
  householdSize?: number;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [cycle, setCycle] = useState<Cycle>(initialCycle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [immediateStart, setImmediateStart] = useState(false);

  const unchanged =
    mode === "switch" && current?.plan === plan && current?.cycle === cycle;
  const dropsHousehold =
    mode === "switch" && current?.plan === "family" && plan === "pro";

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, cycle, immediateStart }),
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

  async function change() {
    if (
      dropsHousehold &&
      householdSize > 0 &&
      !window.confirm(
        `Les ${householdSize} membre${householdSize > 1 ? "s" : ""} de ton foyer repasseront en formule gratuite. Continuer ?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, cycle }),
      });
      const body = await response.json().catch(() => ({}));

      if (response.ok) {
        setDone(
          body.upgrade
            ? `Tu es passé en ${PLAN_LABELS[plan]}. La différence au prorata vient d’être facturée.`
            : `Tu es passé en ${PLAN_LABELS[plan]}. La différence sera déduite de ta prochaine facture.`,
        );
        router.refresh();
      } else {
        setError(
          body.code === "card_declined"
            ? "Ta banque a refusé le paiement de la différence. Rien n’a changé : mets à jour ta carte dans « Gérer mon abonnement »."
            : "Le changement n’a pas pu être fait. Rien n’a été modifié, réessaie dans un instant.",
        );
      }
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
        {(["pro", "family"] as const).map((value) => {
          const selected = plan === value;
          const isCurrent = current?.plan === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPlan(value)}
              className={`rounded-[10px] border p-4 text-left transition-colors ${
                selected
                  ? "border-[rgb(var(--accent-rgb)/.6)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] hover:border-[var(--border-strong)]"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  {value === "family" && (
                    <Users className="size-4 text-[var(--accent-light)]" />
                  )}
                  {PLAN_LABELS[value]}
                  {isCurrent && (
                    <span className="rounded-full bg-[rgba(255,255,255,.07)] px-2 py-px text-[10px] font-semibold tracking-wide text-[var(--text-faint)] uppercase">
                      Actuelle
                    </span>
                  )}
                </span>
                <span className="mono text-sm">
                  {formatPrice(value, cycle)}
                  <span className="text-[var(--text-faint)]">
                    {cycle === "monthly" ? "/mois" : "/an"}
                  </span>
                </span>
              </div>
              <p className="m-0 mt-1.5 text-[13px] leading-[1.5] text-[var(--text-dim)]">
                {PITCH[value]}
              </p>
            </button>
          );
        })}
      </div>

      {dropsHousehold && householdSize > 0 && (
        <p className="m-0 text-[13px] text-[var(--warning-light)]">
          Le Pro ne couvre que toi : les {householdSize} membre
          {householdSize > 1 ? "s" : ""} de ton foyer repasseront en gratuit.
        </p>
      )}

      {mode === "checkout" && (
        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-[1.55] text-[var(--text-dim)]">
          <input
            type="checkbox"
            checked={immediateStart}
            onChange={(event) => setImmediateStart(event.target.checked)}
            className="mt-[3px] accent-[var(--accent)]"
          />
          <span>
            Je demande à profiter de la formule dès maintenant, avant la fin du
            délai de rétractation de 14 jours. Si je me rétracte dans ce délai,
            seuls les jours utilisés me seront facturés.
          </span>
        </label>
      )}

      {mode === "checkout" ? (
        <button
          type="button"
          onClick={pay}
          disabled={busy || !immediateStart}
          className="btn-primary h-11 self-start px-5 text-sm disabled:opacity-60"
        >
          {busy
            ? "Ouverture du paiement…"
            : `Payer ${formatPrice(plan, cycle)} — ${PLAN_LABELS[plan]}`}
          {!busy && <ArrowRight className="size-4" />}
        </button>
      ) : (
        <button
          type="button"
          onClick={change}
          disabled={busy || unchanged}
          className="btn-primary h-11 self-start px-5 text-sm disabled:opacity-50"
        >
          {busy
            ? "Changement en cours…"
            : unchanged
              ? "C’est ta formule actuelle"
              : `Passer en ${PLAN_LABELS[plan]} ${cycle === "yearly" ? "annuel" : "mensuel"}`}
          {!busy && !unchanged && <ArrowRight className="size-4" />}
        </button>
      )}

      <p className="m-0 text-xs text-[var(--text-faint)]">
        {mode === "checkout"
          ? "Paiement sécurisé par Stripe. Sans engagement : résiliable à tout moment depuis cette page. TVA non applicable, art. 293 B du CGI."
          : "Montée en gamme facturée tout de suite au prorata des jours restants ; descente déduite de la prochaine facture. TVA non applicable, art. 293 B du CGI."}
      </p>

      {done && (
        <p role="status" className="m-0 text-[13px] text-[var(--positive-light)]">
          {done}
        </p>
      )}

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

/** Accès au portail Stripe pour un abonné : carte, factures, résiliation. */
export function ManageSubscription() {
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Résiliation en un clic, exigée par la loi : ouvre directement l'écran de
  // résiliation de Stripe, sans passer par un menu.
  async function cancel() {
    setCancelling(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/cancel", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.url) {
        window.location.assign(body.url);
        return;
      }
      setError("La résiliation n’a pas pu s’ouvrir. Réessaie, ou utilise « Gérer mon abonnement ».");
    } catch {
      setError("Connexion interrompue. Réessaie.");
    }
    setCancelling(false);
  }

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
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={open}
          disabled={busy}
          className="btn-secondary h-10 px-4 text-sm disabled:opacity-60"
        >
          {busy ? "Ouverture…" : "Gérer mon abonnement"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={cancelling}
          className="h-10 rounded-[var(--radius-sm)] border border-[rgba(240,113,104,.3)] px-4 text-sm text-[var(--danger-light)] transition-colors hover:bg-[rgba(240,113,104,.1)] disabled:opacity-60"
        >
          {cancelling ? "Ouverture…" : "Résilier mon abonnement"}
        </button>
      </div>
      <p className="m-0 text-xs text-[var(--text-faint)]">
        Carte, factures et changement de moyen de paiement dans « Gérer ». La
        résiliation prend effet à la fin de la période payée ; une
        confirmation t’est envoyée par e-mail.
      </p>
      {error && (
        <p role="alert" className="m-0 text-xs text-[var(--danger-light)]">
          {error}
        </p>
      )}
    </div>
  );
}
