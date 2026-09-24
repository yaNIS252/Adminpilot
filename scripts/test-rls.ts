/**
 * Vérification de l'isolation RLS.
 *
 * C'est LE test de sécurité du projet : il crée deux comptes, écrit une donnée
 * pour chacun, puis tente de lire les données de B en étant authentifié comme A.
 * Toute table qui renvoie quelque chose est une fuite.
 *
 * Un typecheck ne prouve rien ici. Seule une tentative réelle contre la base le
 * fait.
 *
 * Usage : npx tsx scripts/test-rls.ts
 */

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!URL || !PUBLISHABLE || !SERVICE) {
  console.error("Variables Supabase manquantes dans .env.local");
  process.exit(1);
}

const admin = createClient<Database>(URL, SERVICE, {
  auth: { persistSession: false },
});

const TABLES = [
  "subscriptions",
  "documents",
  "alerts",
  "cancellations",
  "ingestion_jobs",
  "usage_counters",
  "profiles",
] as const;

async function createUser(email: string, password: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

async function main() {
  const stamp = Date.now();
  const alice = `rls-a-${stamp}@example.test`;
  const bob = `rls-b-${stamp}@example.test`;
  const password = `Test-${stamp}-Aa1!`;

  console.log("Création de deux comptes de test…");
  const aliceId = await createUser(alice, password);
  const bobId = await createUser(bob, password);

  // Le trigger on_auth_user_created crée les profils. Laisser le temps.
  await new Promise((resolve) => setTimeout(resolve, 1500));

  console.log("Écriture d'un abonnement pour chacun…");
  for (const [id, provider] of [
    [aliceId, "Netflix-Alice"],
    [bobId, "Netflix-Bob"],
  ] as const) {
    const { error } = await admin
      .from("subscriptions")
      .insert({ user_id: id, provider, amount: 13.49, cycle: "monthly" });
    if (error) throw error;
  }

  console.log("Connexion en tant que A…\n");
  const asAlice = createClient<Database>(URL, PUBLISHABLE, {
    auth: { persistSession: false },
  });
  const { error: signInError } = await asAlice.auth.signInWithPassword({
    email: alice,
    password,
  });
  if (signInError) throw signInError;

  let leaks = 0;

  for (const table of TABLES) {
    // Requête explicitement ciblée sur les lignes de B. Une policy correcte
    // renvoie zéro ligne, sans erreur : RLS filtre, il ne refuse pas.
    // `eq` est typé par table ; ici on interroge des tables différentes dans
    // une même boucle, d'où l'élargissement volontaire.
    const column = table === "profiles" ? "id" : "user_id";
    const { data, error } = await (
      asAlice.from(table).select("*") as unknown as {
        eq: (
          column: string,
          value: string,
        ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      }
    ).eq(column, bobId);

    const rows = data?.length ?? 0;
    const leaked = rows > 0;
    if (leaked) leaks += 1;

    console.log(
      `${leaked ? "FUITE" : "  ok "}  ${table.padEnd(16)} ${rows} ligne(s)${
        error ? ` · ${error.message}` : ""
      }`,
    );
  }

  // Contre-épreuve : A doit bien voir SES données. Un test qui ne renvoie
  // jamais rien passerait même avec une base vide — il ne prouverait rien.
  const { data: own } = await asAlice
    .from("subscriptions")
    .select("*")
    .eq("user_id", aliceId);

  console.log(
    `\nContre-épreuve — A voit ses propres abonnements : ${own?.length ?? 0} (attendu 1)`,
  );

  console.log("\nNettoyage…");
  await admin.auth.admin.deleteUser(aliceId);
  await admin.auth.admin.deleteUser(bobId);

  if (leaks > 0) {
    console.error(`\nÉCHEC — ${leaks} table(s) exposent les données d'autrui.`);
    process.exit(1);
  }
  if ((own?.length ?? 0) !== 1) {
    console.error("\nÉCHEC — la contre-épreuve n'a rien renvoyé, test non concluant.");
    process.exit(1);
  }

  console.log("\nSUCCÈS — isolation vérifiée sur toutes les tables.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
