"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, Download, LogOut, Trash2 } from "lucide-react";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Export et suppression de compte — obligations RGPD, articles 20 et 17.
 *
 * La suppression demande de retaper l'adresse. Ce n'est pas de la cérémonie :
 * l'action est définitive, irréversible et emporte les documents. Un simple
 * bouton « Supprimer » finirait par être cliqué par accident.
 */
export function AccountActions({ email }: { email: string }) {
  const router = useRouter();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function deleteAccount() {
    setBusy(true);
    setError(null);

    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmEmail }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "La suppression a échoué.");
      setBusy(false);
      return;
    }

    await createClient().auth.signOut();
    router.push("/");
  }

  return (
    <section className="card-sheen anim-up rounded-[var(--radius-xl)] border border-[var(--border)] p-5">
      <h2 className="mt-0 mb-3.5 text-[15px] font-semibold">Ton compte</h2>

      <div className="flex flex-wrap gap-2">
        <a
          href="/api/account/export"
          className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3.5 py-2.5 text-sm text-[var(--text-muted)] no-underline transition-colors hover:bg-[rgba(255,255,255,.06)] hover:text-white"
        >
          <Download className="size-4" />
          Exporter mes données
        </a>
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3.5 py-2.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[rgba(255,255,255,.06)] hover:text-white"
        >
          <LogOut className="size-4" />
          Se déconnecter
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex items-center gap-2 rounded-[var(--radius-sm)] px-3.5 py-2.5 text-sm text-[var(--danger-light)] transition-colors hover:bg-[rgba(240,113,104,.1)]"
        >
          <Trash2 className="size-4" />
          Supprimer mon compte
        </button>
      </div>

      {open && (
        <div className="mt-4 rounded-[var(--radius)] border border-[rgba(240,113,104,.35)] bg-[rgba(240,113,104,.05)] p-4">
          <p className="m-0 mb-3 flex gap-2.5 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--danger)]" />
            <span>
              Cette action est définitive. Tes documents, abonnements et alertes
              seront supprimés, et ton abonnement payant annulé. Rien ne peut
              être récupéré ensuite.
            </span>
          </p>

          <label className="mb-2 block text-xs text-[var(--text-faint)]">
            Saisis <strong className="text-[var(--text)]">{email}</strong> pour
            confirmer.
          </label>
          <input
            value={confirmEmail}
            onChange={(event) => setConfirmEmail(event.target.value)}
            autoComplete="off"
            className="mb-3 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 py-2.5 text-sm outline-none focus:border-[var(--danger)]"
          />

          {error && (
            <p role="alert" className="m-0 mb-2.5 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={busy || confirmEmail.trim() !== email}
            onClick={deleteAccount}
            className="rounded-[var(--radius-sm)] bg-[var(--danger)] px-4 py-2.5 text-sm font-semibold text-[#2a0805] transition-opacity disabled:opacity-40"
          >
            {busy ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      )}
    </section>
  );
}
