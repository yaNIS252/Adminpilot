import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Limitation de débit, adossée à Postgres.
 *
 * Pas de service externe : l'atomicité vient du upsert, et une dépendance de
 * moins est une panne de moins. Le coût est une requête par action limitée, ce
 * qui est négligeable devant un appel au modèle.
 *
 * Les limites visent l'abus, pas l'usage : un utilisateur normal ne doit jamais
 * les rencontrer. Elles protègent surtout la facture IA, qui est le seul poste
 * capable de déraper vite.
 */

export const LIMITS = {
  /** Uploads par utilisateur. Chacun déclenche un appel au modèle. */
  upload: { limit: 30, windowSecs: 3600 },
  /** Emails reçus par adresse d'ingestion. Un transfert massif reste plausible. */
  inbound: { limit: 200, windowSecs: 3600 },
  /** Recherches en langage naturel. */
  search: { limit: 60, windowSecs: 3600 },
  /** Changements de photo de profil. */
  avatar: { limit: 10, windowSecs: 3600 },
  /** Invitations au foyer : chacune peut partir par e-mail. */
  invite: { limit: 20, windowSecs: 3600 },
} as const;

export type LimitKind = keyof typeof LIMITS;

/**
 * Consomme un jeton. Renvoie `true` si l'action est permise.
 *
 * En cas d'indisponibilité de la base, on laisse passer : bloquer tout le
 * service parce que le compteur est inaccessible serait une panne pire que
 * l'abus qu'on cherche à éviter.
 */
export async function consume(
  kind: LimitKind,
  identifier: string,
): Promise<boolean> {
  const { limit, windowSecs } = LIMITS[kind];

  try {
    const { data, error } = await createAdminClient().rpc(
      "consume_rate_limit",
      {
        p_bucket: `${kind}:${identifier}`,
        p_limit: limit,
        p_window_secs: windowSecs,
      },
    );

    if (error) return true;
    return data ?? true;
  } catch {
    return true;
  }
}

/** Réponse normalisée, avec le délai avant réessai. */
export function tooManyRequests(kind: LimitKind): Response {
  const { limit, windowSecs } = LIMITS[kind];

  return Response.json(
    { error: "trop de requêtes", limit, windowSecs },
    { status: 429, headers: { "retry-after": String(windowSecs) } },
  );
}
