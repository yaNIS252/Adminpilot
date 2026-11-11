import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Autorisation des tâches planifiées et des routes internes : en-tête
 * `Authorization: Bearer <CRON_SECRET>`.
 *
 * Comparaison en temps constant (sur des empreintes de même longueur) : une
 * comparaison ordinaire s'arrête au premier caractère différent, et ce temps
 * de réponse permet en théorie de deviner le secret caractère par caractère.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(given), digest(`Bearer ${secret}`));
}
