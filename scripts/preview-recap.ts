/**
 * Aperçu du récapitulatif mensuel d'un compte de test, sans rien envoyer.
 * Développement uniquement.
 *
 * Usage : npm run preview:recap -- demo@adminpilot.test 2026-10-02 sortie.html
 */

import { writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { buildRecap, isEmptyRecap, renderRecapEmail } from "../src/lib/alerts/recap";
import type { Database } from "../src/lib/supabase/types";

const [email, day, output] = process.argv.slice(2);
if (!email?.endsWith(".test") || !output) {
  console.error("Usage : preview:recap -- <adresse .test> <AAAA-MM-JJ> <fichier.html>");
  process.exit(1);
}

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  const { data: profile } = await db.from("profiles").select("id, name").eq("email", email).single();
  if (!profile) throw new Error("compte introuvable");
  const data = await buildRecap(db as never, profile.id, new Date(`${day}T08:00:00Z`));
  const rendered = renderRecapEmail(data, { name: profile.name, siteUrl: "https://adminpilot-ashen.vercel.app" });
  writeFileSync(output, rendered.html);
  console.log(JSON.stringify({ subject: rendered.subject, empty: isEmptyRecap(data), ...data }, null, 1));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
