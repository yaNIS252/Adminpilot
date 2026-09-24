import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

/**
 * Client à privilèges élevés — CONTOURNE TOUTES LES POLICIES RLS.
 *
 * Réservé au pipeline d'ingestion, aux crons et aux webhooks, qui écrivent pour
 * le compte d'un utilisateur sans porter sa session. Chaque requête doit filtrer
 * explicitement sur `user_id` : ici, plus aucun garde-fou de la base ne joue.
 *
 * L'import `server-only` fait échouer le build si ce module atteint un bundle
 * client — c'est volontaire, la clé ne doit jamais fuiter.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
