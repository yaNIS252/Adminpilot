import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Réglages Sentry communs au serveur et au navigateur.
 *
 * Inactif sans `NEXT_PUBLIC_SENTRY_DSN`. Aucune donnée personnelle ne part :
 * ni cookies, ni en-têtes, ni corps de requête, ni adresse e-mail. Un
 * document administratif contient nom, adresse et références de contrat :
 * un rapport d'erreur ne doit jamais en transporter.
 */

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

function scrub(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    // L'URL reste utile au diagnostic, pas ses paramètres (jetons, adresses).
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
    delete event.request.query_string;
  }
  if (event.user) event.user = { id: event.user.id };
  return event;
}

export const sentryOptions = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  // Erreurs seulement : le suivi de performance consommerait le quota gratuit.
  tracesSampleRate: 0,
  beforeSend: scrub,
};
