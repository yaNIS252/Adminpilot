import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./types";

/**
 * Client Supabase pour Server Components, Server Actions et Route Handlers.
 * Agit sous l'identité de l'utilisateur connecté : les policies RLS s'appliquent.
 *
 * À créer à chaque requête — ne jamais mettre en variable de module, le cookie
 * store est propre à la requête en cours.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Appelé depuis un Server Component : l'écriture de cookies y est
            // interdite. Le middleware rafraîchit déjà la session, donc ignorer.
          }
        },
      },
    },
  );
}

/**
 * Récupère l'utilisateur authentifié, ou `null`.
 *
 * Toujours `getUser()` et jamais `getSession()` : seul `getUser()` revalide le
 * jeton auprès de Supabase. Un cookie de session peut être forgé.
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
