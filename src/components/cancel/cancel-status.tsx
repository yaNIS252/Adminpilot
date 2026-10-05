"use client";

import { useRouter } from "next/navigation";
import { CircleCheck, RotateCcw } from "lucide-react";
import { useState } from "react";

/**
 * « J'ai résilié » / « Reprendre le suivi ». Une résiliation déclarée sort
 * l'abonnement du total et coupe ses rappels ; la reprise les recrée.
 */
export function CancelStatus({
  subscriptionId,
  provider,
  cancelled,
}: {
  subscriptionId: string;
  provider: string;
  cancelled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(status: "cancelled" | "active") {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/subscriptions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: subscriptionId, status }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError("La mise à jour n’a pas pu être enregistrée.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="m-0 text-sm text-[var(--text-dim)]">
        {cancelled
          ? `${provider} est marqué résilié : il ne compte plus dans tes dépenses. Si un nouveau prélèvement arrive, il réapparaîtra tout seul.`
          : `Une fois la résiliation confirmée par ${provider}, indique-le : l’abonnement sort de tes dépenses et ses rappels s’arrêtent. Si tu transfères l’e-mail de confirmation, c’est automatique.`}
      </p>
      <button
        type="button"
        onClick={() => update(cancelled ? "active" : "cancelled")}
        disabled={busy}
        className="btn-secondary inline-flex h-10 items-center gap-1.5 self-start px-4 text-[13px] disabled:opacity-60"
      >
        {cancelled ? <RotateCcw className="size-4" /> : <CircleCheck className="size-4" />}
        {busy ? "Un instant…" : cancelled ? "Reprendre le suivi" : "J’ai résilié"}
      </button>
      {error && (
        <p role="alert" className="m-0 text-xs text-[var(--danger-light)]">
          {error}
        </p>
      )}
    </div>
  );
}
