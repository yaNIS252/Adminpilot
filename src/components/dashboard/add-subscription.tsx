"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Forward, Plus, X } from "lucide-react";
import { useState } from "react";

import { SelectMenu } from "@/components/shared/select-menu";

const CYCLES = [
  { value: "monthly", label: "par mois" },
  { value: "yearly", label: "par an" },
  { value: "quarterly", label: "par trimestre" },
  { value: "weekly", label: "par semaine" },
] as const;

const CATEGORIES = [
  { value: "streaming", label: "Streaming" },
  { value: "telecom", label: "Télécom" },
  { value: "energie", label: "Énergie" },
  { value: "assurance", label: "Assurance" },
  { value: "logiciel", label: "Logiciels" },
  { value: "presse", label: "Presse" },
  { value: "sport", label: "Sport" },
  { value: "transport", label: "Transport" },
  { value: "logement", label: "Logement" },
  { value: "sante", label: "Santé" },
  { value: "banque", label: "Banque" },
  { value: "autre", label: "Autre" },
] as const;

const field =
  "h-10 w-full rounded-[8px] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 text-sm outline-none focus:border-[var(--accent)]";

/**
 * Ajout d'un abonnement que l'analyse n'a pas trouvé. Deux chemins, présentés
 * côte à côte : transférer l'e-mail de facture (l'analyse remplit tout), ou
 * saisir soi-même (prélèvement sans facture, paiement en espèces…).
 */
export function AddSubscription({ inboxAddress }: { inboxAddress: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<string>("monthly");
  const [category, setCategory] = useState<string>("autre");
  const [renewal, setRenewal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<React.ReactNode>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const parsed = amount.trim() ? Number(amount.replace(",", ".")) : null;
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setError("Montant invalide.");
      setSaving(false);
      return;
    }

    const response = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: provider.trim(),
        amount: parsed,
        cycle,
        category,
        next_renewal: renewal || null,
      }),
    }).catch(() => null);
    setSaving(false);

    if (response?.ok) {
      setProvider("");
      setAmount("");
      setRenewal("");
      setOpen(false);
      router.refresh();
      return;
    }
    const body = (await response?.json().catch(() => null)) as { code?: string } | null;
    setError(
      body?.code === "duplicate" ? (
        "Cet abonnement est déjà suivi."
      ) : body?.code === "own_subscription" ? (
        "L’abonnement AdminPilot apparaît tout seul, inutile de l’ajouter."
      ) : body?.code === "limit" ? (
        <>
          Tu as atteint la limite de la formule gratuite.{" "}
          <Link href="/reglages?formule=pro#formules">Passer Pro</Link> pour en suivre autant que tu
          veux.
        </>
      ) : (
        "L’abonnement n’a pas pu être ajouté. Réessaie."
      ),
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary h-10 self-start px-4 text-[13px]"
      >
        <Plus className="size-4" />
        Ajouter un abonnement
      </button>
    );
  }

  return (
    <section className="card-sheen anim-up relative rounded-[var(--radius-xl)] border border-[var(--border)] p-5">
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Fermer"
        className="absolute top-3 right-3 grid size-8 place-items-center rounded-lg text-[var(--text-faint)] hover:bg-[rgba(255,255,255,.06)] hover:text-[var(--text)]"
      >
        <X className="size-4" />
      </button>
      <h2 className="m-0 text-[15px] font-semibold">Ajouter un abonnement</h2>

      <div className="mt-3 flex items-start gap-3 rounded-[10px] border border-[var(--border-soft)] bg-[rgba(255,255,255,.02)] p-3.5 text-[13px] leading-[1.55] text-[var(--text-dim)]">
        <Forward className="mt-0.5 size-4 shrink-0 text-[var(--accent-light)]" />
        <p className="m-0">
          <strong className="text-[var(--text)]">Le plus simple : transfère l’e-mail de facture</strong>{" "}
          à <span className="mono text-[var(--text)]">{inboxAddress}</span>. L’analyse remplit
          tout (montant, échéance, lien de résiliation), et ton transfert aide
          AdminPilot à mieux reconnaître ce fournisseur pour tout le monde.
          Sinon, saisis-le ci-dessous.
        </p>
      </div>

      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium sm:col-span-2">
          Fournisseur
          <input
            required
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            maxLength={120}
            placeholder="Ex. Netflix, salle de sport, mutuelle…"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Montant (€)
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="13,49"
            className={field}
          />
        </label>
        <div className="flex flex-col gap-1.5 text-[13px] font-medium">
          Fréquence
          <SelectMenu block label="Fréquence" value={cycle} options={CYCLES} onChange={setCycle} />
        </div>
        <div className="flex flex-col gap-1.5 text-[13px] font-medium">
          Catégorie
          <SelectMenu block label="Catégorie" value={category} options={CATEGORIES} onChange={setCategory} />
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Prochain prélèvement <span className="font-normal text-[var(--text-faint)]">(facultatif)</span>
          <input
            type="date"
            value={renewal}
            onChange={(event) => setRenewal(event.target.value)}
            className={field}
          />
        </label>

        {error && (
          <p role="alert" className="m-0 text-[13px] text-[var(--danger-light)] sm:col-span-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={saving || !provider.trim()}
            className="btn-primary h-10 px-4 text-[13px] disabled:opacity-60"
          >
            {saving ? "Ajout…" : "Ajouter"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-10 px-3 text-[13px] text-[var(--text-dim)] hover:text-[var(--text)]"
          >
            Annuler
          </button>
        </div>
      </form>
    </section>
  );
}
