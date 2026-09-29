/**
 * Lien de connexion à usage unique pour un compte de test — développement
 * uniquement. Crée le compte s'il n'existe pas, sans toucher à ses données.
 *
 * Usage : npm run login:link -- membre@adminpilot.test [/chemin]
 */

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/types";

const SITE = process.env.LOCAL_SITE_URL ?? "http://localhost:3100";
const email = process.argv[2];
const next = process.argv[3] ?? "/dashboard";

if (!email?.endsWith(".test")) {
  // Garde-fou : ce script ne doit jamais servir à entrer dans un vrai compte.
  console.error("Adresse de test attendue (domaine .test).");
  process.exit(1);
}

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error?.message.includes("not found") || error?.status === 404) {
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createError) throw createError;
    return main();
  }
  if (error) throw error;

  console.log(
    `${SITE}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
