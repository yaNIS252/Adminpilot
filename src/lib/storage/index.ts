import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stockage des documents — Supabase Storage.
 *
 * Remplace Cloudflare R2. R2 avait été retenu pour l'absence de frais de sortie
 * à grande échelle, mais c'est un problème de 50 000 utilisateurs, pas de MVP.
 * Supabase Storage est déjà en place, partage l'authentification du reste de la
 * base, et supprime une dépendance externe — donc une panne et un compte de
 * moins à administrer.
 *
 * Le bucket est privé. Toute consultation passe par une URL signée à durée
 * courte : un document administratif porte nom, adresse, références de contrat
 * et parfois coordonnées bancaires.
 */

const BUCKET = "documents";

/**
 * Chemin de stockage. Le premier segment est l'identifiant utilisateur — c'est
 * ce que lisent les policies de `storage.objects`, et ce qui rend la purge d'un
 * compte aussi simple qu'une suppression de préfixe.
 */
export function buildKey(input: {
  userId: string;
  source: "email" | "upload";
  contentHash: string;
  extension: string;
}): string {
  return `${input.userId}/${input.source}/${input.contentHash}.${input.extension}`;
}

export async function uploadRaw(input: {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
}): Promise<string> {
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(input.key, input.body, {
      contentType: input.contentType,
      upsert: true,
    });

  if (error) throw error;
  return input.key;
}

export async function getRaw(key: string): Promise<{
  base64: string;
  contentType: string;
}> {
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .download(key);

  if (error) throw error;

  const bytes = new Uint8Array(await data.arrayBuffer());

  return {
    base64: Buffer.from(bytes).toString("base64"),
    contentType: data.type || "application/octet-stream",
  };
}

/** URL de consultation à durée limitée. Une heure par défaut. */
export async function getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUrl(key, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

export async function deleteRaw(key: string): Promise<void> {
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .remove([key]);

  if (error) throw error;
}
