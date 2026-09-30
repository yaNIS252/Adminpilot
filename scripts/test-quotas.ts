/**
 * Vérifie les limites de la formule gratuite sur le vrai code du pipeline,
 * en extraction simulée (aucun appel au modèle). Développement uniquement.
 *
 * Travaille sur `gratuit@adminpilot.test`, dont il EFFACE les abonnements,
 * documents, tâches et compteurs avant de commencer.
 *
 * Usage : npm run test:quotas
 */

import { createClient } from "@supabase/supabase-js";

import { checkLimit } from "../src/lib/billing/quotas";
import { PLAN_LIMITS } from "../src/lib/constants";
import { processDocumentJob, processEmailJob } from "../src/lib/ingest/pipeline";
import type { Database } from "../src/lib/supabase/types";

const EMAIL = "gratuit@adminpilot.test";

if (process.env.ADMINPILOT_AI_MODE !== "mock") {
  console.error("À lancer en extraction simulée (ADMINPILOT_AI_MODE=mock).");
  process.exit(1);
}

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "OK  " : "ÉCHEC"} ${label} — obtenu ${JSON.stringify(actual)}${ok ? "" : `, attendu ${JSON.stringify(expected)}`}`);
}

async function job(userId: string, source: "email" | "upload", status = "processing") {
  const { data, error } = await db
    .from("ingestion_jobs")
    .insert({
      user_id: userId,
      source,
      content_hash: crypto.randomUUID(),
      raw_url: `test/${crypto.randomUUID()}`,
      mime_type: source === "email" ? "message/rfc822" : "application/pdf",
      status: status as "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function reset(userId: string) {
  for (const table of ["alerts", "subscriptions", "documents", "ingestion_jobs", "usage_counters"] as const) {
    const { error } = await db.from(table).delete().eq("user_id", userId);
    if (error) throw error;
  }
  await db.from("profiles").update({ plan: "free" }).eq("id", userId);
}

async function counts(userId: string) {
  const { data } = await db.from("subscriptions").select("over_quota").eq("user_id", userId);
  return {
    visibles: (data ?? []).filter((row) => !row.over_quota).length,
    masques: (data ?? []).filter((row) => row.over_quota).length,
  };
}

function email(provider: { name: string; domain: string }) {
  return {
    from: `factures@${provider.domain}`,
    subject: `Votre facture ${provider.name}`,
    date: new Date().toISOString(),
    body: `Bonjour, montant prélevé : 12,99 € par mois. Prochain prélèvement le 15/11/2026.`,
  };
}

async function main() {
  const { data: profile } = await db.from("profiles").select("id").eq("email", EMAIL).single();
  if (!profile) throw new Error(`${EMAIL} introuvable — lancer d'abord npm run login:link -- ${EMAIL}`);
  const userId = profile.id;
  await reset(userId);

  const { data: providers } = await db
    .from("known_providers")
    .select("name, domain")
    .order("name")
    .limit(8);
  if (!providers || providers.length < 8) throw new Error("catalogue de fournisseurs trop court");

  console.log(`\n— Abonnements (limite ${PLAN_LIMITS.free.subscriptions})`);
  for (const provider of providers.slice(0, 7)) {
    await processEmailJob({ id: await job(userId, "email"), user_id: userId, attempts: 0, payload: email(provider) });
  }
  check("7 fournisseurs différents → 5 visibles, 2 masqués", await counts(userId), { visibles: 5, masques: 2 });

  // Nouvelle facture d'un fournisseur déjà visible : mise à jour, pas de 6e.
  await processEmailJob({ id: await job(userId, "email"), user_id: userId, attempts: 0, payload: email(providers[0]) });
  check("facture suivante d'un abonnement visible → rien de plus", await counts(userId), { visibles: 5, masques: 2 });

  // Un abonnement retiré libère sa place pour le suivant.
  const { data: oneVisible } = await db
    .from("subscriptions").select("id").eq("user_id", userId).eq("over_quota", false).limit(1).single();
  await db.from("subscriptions").delete().eq("id", oneVisible!.id);
  await processEmailJob({ id: await job(userId, "email"), user_id: userId, attempts: 0, payload: email(providers[7]) });
  check("après suppression d'un visible, le suivant prend la place", await counts(userId), { visibles: 5, masques: 2 });

  const { count: alertsOnHidden } = await db
    .from("alerts").select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("ref_id", ((await db.from("subscriptions").select("id").eq("user_id", userId).eq("over_quota", true)).data ?? []).map((row) => row.id));
  check("aucune alerte programmée sur un abonnement masqué", alertsOnHidden, 0);

  console.log(`\n— Documents (limite ${PLAN_LIMITS.free.documents})`);
  const docs = Array.from({ length: 9 }, (_, index) => ({
    user_id: userId,
    file_url: `test/doc-${index}`,
    mime_type: "application/pdf",
    filename_original: `doc-${index}.pdf`,
  }));
  await db.from("documents").insert(docs);
  check("9 documents → envoi autorisé", (await checkLimit(userId, "free", "documents")).allowed, true);

  await job(userId, "upload", "pending");
  check("9 documents + 1 en attente d'analyse → 11e refusé", await checkLimit(userId, "free", "documents"), { allowed: false, current: 10, max: 10 });

  await db.from("documents").insert({ ...docs[0], file_url: "test/doc-10", filename_original: "doc-10.pdf" });
  const late = await job(userId, "upload");
  const result = await processDocumentJob({
    id: late, user_id: userId, mime_type: "application/pdf", raw_url: "test/late",
    payload: { base64: Buffer.from("%PDF-1.4 test").toString("base64"), filename: "late.pdf" },
  });
  const { data: lateJob } = await db.from("ingestion_jobs").select("status, attempts").eq("id", late).single();
  check("document analysé au-delà de la limite → refusé sans appel au modèle", { refuse: "overQuota" in result, statut: lateJob?.status }, { refuse: true, statut: "failed" });
  const { count: docCount } = await db.from("documents").select("id", { count: "exact", head: true }).eq("user_id", userId);
  check("toujours 10 documents", docCount, 10);

  console.log("\n— Formules payantes");
  await db.from("profiles").update({ plan: "pro" }).eq("id", userId);
  check("Pro : documents illimités", (await checkLimit(userId, "pro", "documents")).allowed, true);
  await processEmailJob({ id: await job(userId, "email"), user_id: userId, attempts: 0, payload: email({ name: "Test Pro", domain: providers[1].domain }) });
  check("Pro : pas de nouveau masqué", (await counts(userId)).masques, 2);

  console.log("\n— Périodiques (recherche, résiliation)");
  check("recherche en gratuit", (await checkLimit(userId, "free", "searches")).allowed, false);
  check("résiliation en gratuit", (await checkLimit(userId, "free", "cancellations")).allowed, false);

  await reset(userId);
  console.log(failures === 0 ? "\nTout est conforme." : `\n${failures} échec(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
