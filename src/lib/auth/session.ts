/**
 * Durée de vie des sessions, tenue par l'application.
 *
 * Supabase, en formule gratuite, ne fait jamais expirer une session : un
 * navigateur connecté une fois le restait indéfiniment, y compris un poste
 * partagé ou un téléphone perdu. On impose ici une reconnexion au bout de
 * 30 jours, ou de 14 jours sans visite. Le cookie est `httpOnly` : un script
 * injecté ne peut ni le lire ni le prolonger.
 */
export const SESSION_COOKIE = "ap_session";
export const SESSION_MAX_MS = 30 * 86_400_000;
export const SESSION_IDLE_MS = 14 * 86_400_000;
/** On ne réécrit le cookie qu'une fois par heure, pas à chaque requête. */
export const SESSION_TOUCH_MS = 3_600_000;

export function readSession(value: string | undefined): { issued: number; seen: number } | null {
  if (!value) return null;
  const [issued, seen] = value.split(".").map(Number);
  return Number.isFinite(issued) && Number.isFinite(seen) ? { issued, seen } : null;
}

export function sessionCookieValue(issued: number, seen: number): string {
  return `${issued}.${seen}`;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_MS / 1000,
};
