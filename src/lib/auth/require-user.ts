import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

/**
 * Récupère l'utilisateur authentifié et son profil, ou `null`.
 *
 * À appeler en première ligne de toute route API privée. Le middleware protège
 * déjà les pages, mais une route API doit vérifier elle-même : un appel direct
 * ne passe pas forcément par le chemin qu'on imagine.
 */
export async function requireUser(): Promise<
  { userId: string; profile: Profile } | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Lecture sous l'identité de l'utilisateur : la policy RLS s'applique, donc
  // même un bug de filtre ici ne peut pas rendre le profil de quelqu'un d'autre.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!profile) return null;

  return { userId: user.id, profile };
}

/**
 * Adresse d'ingestion de l'utilisateur, celle qu'il configure dans Gmail.
 */
export function inboxAddress(profile: Pick<Profile, "inbox_token">): string {
  const domain = process.env.INBOUND_DOMAIN ?? "in.zylax.fr";
  return `u-${profile.inbox_token}@${domain}`;
}

/**
 * Régénère le jeton d'ingestion.
 *
 * Utile si l'adresse fuite et se met à recevoir du spam. Passe par le client
 * admin : l'utilisateur ne doit pas pouvoir choisir son propre jeton, sans quoi
 * il pourrait tenter de revendiquer celui d'un autre.
 */
export async function rotateInboxToken(userId: string): Promise<string> {
  const db = createAdminClient();
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  const { error } = await db
    .from("profiles")
    .update({ inbox_token: token })
    .eq("id", userId);

  if (error) throw error;
  return token;
}
