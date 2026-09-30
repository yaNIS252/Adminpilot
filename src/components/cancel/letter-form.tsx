"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

/**
 * Formulaire de la lettre de résiliation.
 *
 * Adresse de l'expéditeur retenue dans le navigateur (et nulle part
 * ailleurs) : on résilie rarement un seul contrat, la retaper à chaque fois
 * serait pénible, et elle n'a aucune raison d'être stockée chez nous.
 */

const STORAGE_KEY = "ap_letter_sender";

type Saved = { name: string; street: string; city: string };

function readSavedRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseSaved(raw: string | null): Saved | null {
  try {
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

const noopSubscribe = () => () => {};

export function LetterForm({
  subscriptionId,
  provider,
  defaultName,
  recipientAddress,
  regenerate,
  registered,
}: {
  subscriptionId: string;
  provider: string;
  defaultName: string;
  recipientAddress: string;
  /** Une lettre existe déjà : le formulaire est replié derrière un bouton. */
  regenerate: boolean;
  /** Le fournisseur attend un courrier : rappeler le recommandé. */
  registered: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!regenerate);
  // Lu hors rendu serveur : le serveur ne connaît pas ce stockage, et une
  // valeur différente au premier rendu ferait diverger l'hydratation.
  const savedRaw = useSyncExternalStore(noopSubscribe, readSavedRaw, () => null);
  const saved = parseSaved(savedRaw);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary mt-4 h-10 px-4 text-sm"
      >
        Refaire la lettre
      </button>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    const name = value("name");
    const street = value("street");
    const city = value("city");
    const reference = value("reference");
    const recipientLines = value("recipient")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    // « 12 rue X, 75011 Paris » → lieu de rédaction = la ville.
    const place = city.replace(/^\d{4,5}\s*/, "").trim() || city.trim();

    try {
      const response = await fetch("/api/cancel/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriptionId,
          sender: { name, address: [street, city] },
          recipientAddress: recipientLines,
          place,
          reference: reference || null,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (response.ok) {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, street, city }));
        } catch {
          // Stockage indisponible (navigation privée) : sans conséquence.
        }
        window.open(`/api/cancel/${body.id}`, "_blank", "noopener");
        setOpen(false);
        router.refresh();
      } else {
        setError(
          response.status === 402
            ? "La lettre de résiliation est incluse dans Pro et Premium."
            : response.status === 429
              ? "Beaucoup de lettres d’un coup : réessaie dans une heure."
              : response.status === 400
                ? recipientLines.length < 2
                  ? "Indique l’adresse complète du fournisseur, sur deux lignes au moins."
                  : "Vérifie les champs : nom, adresse et ville sont nécessaires."
                : "La lettre n’a pas pu être créée. Réessaie.",
        );
      }
    } catch {
      setError("Connexion interrompue. Réessaie.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-1 flex flex-col gap-4">
      <fieldset key={savedRaw ?? "vide"} className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="mb-2 p-0 text-[13px] font-medium">Tes coordonnées</legend>
        <Field
          label="Nom et prénom"
          name="name"
          defaultValue={saved?.name || defaultName}
          autoComplete="name"
          required
        />
        <Field
          label="Adresse"
          name="street"
          defaultValue={saved?.street ?? ""}
          autoComplete="street-address"
          placeholder="12 rue des Lilas"
          required
        />
        <Field
          label="Code postal et ville"
          name="city"
          defaultValue={saved?.city ?? ""}
          autoComplete="address-level2"
          placeholder="75011 Paris"
          required
        />
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="mb-2 p-0 text-[13px] font-medium">Le contrat</legend>
        <Field
          label="Numéro de contrat ou de client (conseillé)"
          name="reference"
          placeholder="Sur tes factures, en haut à droite"
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--text-dim)]">
            Adresse du service résiliation de {provider}
          </span>
          <textarea
            name="recipient"
            defaultValue={recipientAddress}
            required
            rows={3}
            placeholder={"Service Résiliation\nTSA 00000\n75000 Paris"}
            className="rounded-[8px] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          {!recipientAddress && (
            <span className="text-xs text-[var(--text-faint)]">
              Elle figure dans tes conditions générales ou sur une facture,
              souvent sous « Service clients » ou « Résiliation ».
            </span>
          )}
        </label>
      </fieldset>

      <button
        type="submit"
        disabled={busy}
        className="btn-primary h-11 self-start px-5 text-sm disabled:opacity-60"
      >
        {busy ? "Préparation…" : "Créer la lettre (PDF)"}
        {!busy && <ArrowRight className="size-4" />}
      </button>

      <p className="m-0 text-xs text-[var(--text-faint)]">
        {registered
          ? "Imprime-la, signe-la et envoie-la en recommandé avec accusé de réception : sans preuve de réception, la date de résiliation est contestable."
          : "Garde une copie de ton envoi : c’est ta preuve de la date de résiliation."}{" "}
        Ton adresse reste dans ce navigateur, elle n’est pas enregistrée chez
        nous.
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
    </form>
  );
}

function Field({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-[var(--text-dim)]">{label}</span>
      <input
        {...rest}
        maxLength={120}
        className="h-10 rounded-[8px] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 text-sm outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}
