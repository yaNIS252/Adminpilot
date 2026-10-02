"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Dernier filet : une erreur que rien d'autre n'a rattrapée. Elle est
 * transmise à Sentry, et l'utilisateur voit une page lisible plutôt qu'un
 * écran blanc.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#0a0a0f",
          color: "#e8e8ef",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>Quelque chose s’est mal passé.</h1>
          <p style={{ color: "#a0a0b2", lineHeight: 1.6, margin: "0 0 20px" }}>
            L’erreur nous a été signalée automatiquement. Tes données ne sont pas
            touchées : réessaie, et si le problème continue, recharge la page.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#f2eee6",
              color: "#16141f",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
