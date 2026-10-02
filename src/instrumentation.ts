import * as Sentry from "@sentry/nextjs";

import { SENTRY_DSN, sentryOptions } from "@/lib/monitoring/sentry-options";

/**
 * Point d'entrée de l'instrumentation côté serveur (Node et Edge).
 * Sans DSN configuré, rien n'est initialisé.
 */
export function register() {
  if (!SENTRY_DSN) return;
  Sentry.init(sentryOptions);
}

/** Erreurs des routes, pages et actions serveur, transmises à Sentry. */
export const onRequestError = Sentry.captureRequestError;
