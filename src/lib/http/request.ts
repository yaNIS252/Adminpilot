import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Utilitaires communs aux routes API.
 *
 * Les routes appelaient toutes `await request.json()` sans filet : un corps
 * malformé — client bogué, requête tronquée, robot d'exploration — levait une
 * `SyntaxError` non rattrapée, qui remonte en 500. Or une charge utile invalide
 * est une erreur du client, pas du serveur : elle vaut 400. La distinction n'est
 * pas cosmétique, un 500 déclenche les alertes de supervision et se confond avec
 * une vraie panne.
 */

/** Motif d'un UUID v4 tel que Postgres l'accepte. */
const UUID = z.string().uuid();

/**
 * Lit et valide le corps JSON. Renvoie une réponse prête à retourner en cas
 * d'échec, jamais une exception.
 */
export async function readJson<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<
  { ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "corps de requête illisible" },
        { status: 400 },
      ),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "requête invalide", details: parsed.error.issues },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Valide un identifiant venu de l'URL.
 *
 * Sans ce contrôle, une valeur non conforme atteint Postgres, qui répond par
 * l'erreur 22P02 « invalid input syntax for type uuid ». Selon la route, elle
 * était soit transformée en 404 trompeur, soit relancée en 500. Le rejeter ici
 * donne un 400 exact et épargne un aller-retour à la base.
 */
export function readUuid(value: string | null): string | null {
  if (!value) return null;
  return UUID.safeParse(value).success ? value : null;
}

/** Réponse normalisée pour un identifiant absent ou malformé. */
export function invalidId(): NextResponse {
  return NextResponse.json(
    { error: "identifiant absent ou invalide" },
    { status: 400 },
  );
}
