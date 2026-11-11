"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

type State = "loading" | "unsupported" | "off" | "on" | "denied" | "busy";

/**
 * Notifications sur cet appareil (Premium), en plus des e-mails. Sur iPhone,
 * elles n'existent que pour l'application ajoutée à l'écran d'accueil.
 */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        return "unsupported" as const;
      }
      if (Notification.permission === "denied") return "denied" as const;
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      return subscription ? ("on" as const) : ("off" as const);
    }
    check()
      .then((next) => !cancelled && setState(next))
      .catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setState("busy");
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(PUBLIC_KEY),
      });
      const response = await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) {
        await subscription.unsubscribe().catch(() => undefined);
        throw new Error("refus");
      }
      setState("on");
    } catch {
      setState("off");
      setError("Activation impossible sur cet appareil. Réessaie.");
    }
  }

  async function disable() {
    setState("busy");
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await fetch(`/api/push?endpoint=${encodeURIComponent(subscription.endpoint)}`, { method: "DELETE" }).catch(
        () => null,
      );
      await subscription.unsubscribe().catch(() => undefined);
    }
    setState("off");
  }

  const on = state === "on";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <p className="m-0 flex flex-1 items-start gap-2 text-sm text-[var(--text-dim)]">
          <BellRing className="mt-0.5 size-4 shrink-0 text-[var(--accent-light)]" />
          <span>
            Notifications sur cet appareil, en plus des e-mails : échéances, hausses de prix,
            nouveaux abonnements.
            {state === "unsupported" && (
              <span className="block text-xs text-[var(--text-faint)]">
                Indisponibles dans ce navigateur. Sur iPhone : ajoute d’abord AdminPilot à l’écran
                d’accueil, puis ouvre-le depuis son icône.
              </span>
            )}
            {state === "denied" && (
              <span className="block text-xs text-[var(--text-faint)]">
                Bloquées pour ce site : autorise-les dans les réglages de ton navigateur.
              </span>
            )}
          </span>
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Notifications sur cet appareil"
          disabled={state === "loading" || state === "busy" || state === "unsupported" || state === "denied"}
          onClick={on ? disable : enable}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
            on ? "bg-[var(--accent)]" : "bg-[rgba(255,255,255,.12)]"
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`}
          />
        </button>
      </div>
      {error && (
        <p role="alert" className="m-0 text-xs text-[var(--danger-light)]">
          {error}
        </p>
      )}
    </div>
  );
}
