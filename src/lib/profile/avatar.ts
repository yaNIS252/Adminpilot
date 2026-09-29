import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const AVATAR_BUCKET = "avatars";

/** URL signée d'une photo de profil, ou `null`. Valable une heure. */
export async function avatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await createAdminClient()
    .storage.from(AVATAR_BUCKET)
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** URLs signées pour plusieurs photos, en un seul appel. */
export async function avatarUrls(
  paths: (string | null)[],
): Promise<Map<string, string>> {
  const wanted = paths.filter((path): path is string => Boolean(path));
  const urls = new Map<string, string>();
  if (wanted.length === 0) return urls;

  const { data } = await createAdminClient()
    .storage.from(AVATAR_BUCKET)
    .createSignedUrls(wanted, 3600);
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}
