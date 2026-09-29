"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

const ERRORS: Record<string, string> = {
  expired: "Cette invitation a expiré entre-temps.",
  invalid: "Ce lien vient d’être utilisé. Demande une nouvelle invitation.",
  inactive: "L’abonnement Premium de ce foyer n’est plus actif.",
  already_member: "Tu fais déjà partie d’un foyer.",
  has_subscription: "Résilie d’abord ton abonnement personnel.",
};

export function JoinHousehold({
  token,
  ownerName,
}: {
  token: string;
  ownerName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/household/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (response.ok) {
        router.push("/dashboard?foyer=rejoint");
        router.refresh();
        return;
      }
      const body = await response.json().catch(() => ({}));
      setError(ERRORS[body.code] ?? "Impossible de rejoindre le foyer pour l’instant.");
    } catch {
      setError("Connexion interrompue. Réessaie.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-7 flex flex-col gap-3">
      <button
        type="button"
        onClick={join}
        disabled={busy}
        className="btn-primary h-11 self-start px-5 text-sm disabled:opacity-60"
      >
        {busy ? "Un instant…" : `Rejoindre le foyer de ${ownerName}`}
        {!busy && <ArrowRight className="size-4" />}
      </button>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-[var(--danger-light)]">
          {error}
        </p>
      )}
    </div>
  );
}
