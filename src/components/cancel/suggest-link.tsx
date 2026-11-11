"use client";

import { Check, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * « Proposer le lien de résiliation » : l'utilisateur colle l'adresse de la
 * page où il résilie. Vérifiée par le serveur (domaine officiel, page lue par
 * l'IA) avant d'être utilisée ; la page se met à jour sur place.
 */
export function SuggestLink({ subscriptionId, provider }: { subscriptionId: string; provider: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "ok" | "no">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("busy");
    const response = await fetch(`/api/subscriptions/${subscriptionId}/cancel-link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    if (response?.ok && body.accepted) {
      setState("ok");
      setMessage(
        body.promoted
          ? "Merci ! Lien vérifié, et ajouté pour tous les utilisateurs de " + provider + "."
          : "Merci ! Lien vérifié : il est maintenant utilisé pour ton abonnement.",
      );
      router.refresh();
      return;
    }
    setState("no");
    setMessage(
      body?.error ??
        `Lien non retenu : ${body?.reason ?? "la page n’a pas pu être vérifiée."} Vérifie que c’est bien la page de résiliation.`,
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text)]"
      >
        <Link2 className="size-3.5" />
        Tu connais le bon lien de résiliation ? Propose-le
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
      <label className="text-xs text-[var(--text-dim)]">
        Adresse de la page où l’on résilie {provider} (site officiel uniquement)
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          type="url"
          required
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            if (state !== "busy") setState("idle");
          }}
          placeholder="https://"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          className="h-10 min-w-0 flex-1 rounded-[8px] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button type="submit" disabled={state === "busy"} className="btn-secondary h-10 px-4 text-[13px] disabled:opacity-60">
          {state === "busy" ? "Vérification…" : "Proposer"}
        </button>
      </div>
      {state === "ok" && (
        <p className="m-0 flex items-center gap-1.5 text-xs text-[var(--positive-light)]">
          <Check className="size-3.5" /> {message}
        </p>
      )}
      {state === "no" && <p className="m-0 text-xs text-[var(--danger-light)]">{message}</p>}
    </form>
  );
}
