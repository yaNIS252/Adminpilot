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
import { trustedLink } from "../src/lib/cancel/links";
import { PLAN_LIMITS } from "../src/lib/constants";
import { processDocumentJob, processEmailJob } from "../src/lib/ingest/pipeline";
import { compareOffers } from "../src/lib/offers";
import { parseSearchQuery } from "../src/lib/search/parse-query";
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

  console.log("\n— Liens de résiliation trouvés dans les e-mails");
  check("lien du domaine du fournisseur accepté", trustedLink("https://www.netflix.com/cancelplan", ["netflix.com"]), "https://www.netflix.com/cancelplan");
  check("domaine piégé refusé (netflix.com.evil.io)", trustedLink("https://netflix.com.evil.io/resilier", ["netflix.com"]), null);
  check("domaine voisin refusé (netflix-compte.xyz)", trustedLink("https://netflix-compte.xyz/resilier", ["netflix.com"]), null);
  check("http non chiffré refusé", trustedLink("http://www.netflix.com/cancelplan", ["netflix.com"]), null);
  check("identifiants dans l'URL refusés", trustedLink("https://user:pass@www.netflix.com/x", ["netflix.com"]), null);

  await reset(userId);
  const { data: netflix } = await db.from("known_providers").select("id, name, domain").eq("name", "Netflix").single();
  const phishing = {
    from: "Netflix <info@account.netflix.com>",
    subject: "Votre facture Netflix",
    date: new Date().toISOString(),
    body: "Montant prélevé : 13,49 € par mois. Gérer : https://netflix-compte.xyz/abonnement/resilier",
  };
  await processEmailJob({ id: await job(userId, "email"), user_id: userId, attempts: 0, payload: phishing });
  let { data: sub } = await db.from("subscriptions").select("provider_id, metadata").eq("user_id", userId).single();
  check("abonnement rattaché au catalogue", sub?.provider_id, netflix!.id);
  check("lien d'hameçonnage non enregistré", (sub?.metadata as Record<string, unknown>)?.manage_url ?? null, null);

  await processEmailJob({
    id: await job(userId, "email"), user_id: userId, attempts: 0,
    payload: { ...phishing, body: "Montant prélevé : 13,49 € par mois. Gérer mon abonnement : https://www.netflix.com/account/cancel" },
  });
  ({ data: sub } = await db.from("subscriptions").select("provider_id, metadata").eq("user_id", userId).single());
  check("lien officiel ajouté à la facture suivante", (sub?.metadata as Record<string, unknown>)?.manage_url ?? null, "https://www.netflix.com/account/cancel");

  console.log("\n— Lecture des recherches (sans modèle, au 2 octobre 2026)");
  const day = new Date("2026-10-02T10:00:00Z");
  const pick = (q: string) => {
    const f = parseSearchQuery(q, day);
    return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null));
  };
  check("« facture EDF de mars »", pick("facture EDF de mars"), { category: "facture", date_from: "2026-03-01", date_to: "2026-03-31", keywords: "edf" });
  check("« fiches de paie 2025 »", pick("fiches de paie 2025"), { category: "travail", date_from: "2025-01-01", date_to: "2025-12-31" });
  check("« assurance plus de 50 € »", pick("assurance plus de 50 €"), { category: "assurance", amount_min: 50 });
  check("« quittance de loyer décembre » → décembre passé", pick("quittance de loyer décembre"), { category: "logement", date_from: "2025-12-01", date_to: "2025-12-31", keywords: "loyer" });
  check("« relevé du mois dernier »", pick("relevé du mois dernier"), { category: "banque", date_from: "2026-09-01", date_to: "2026-09-30" });
  check("« contrat de travail » → travail, pas contrat", pick("contrat de travail"), { category: "travail" });
  check("« prélèvement Netflix » → mots sans accents", pick("prélèvement Netflix"), { keywords: "prelevement netflix" });
  check("« entre 20 et 40 euros »", pick("entre 20 et 40 euros"), { amount_min: 20, amount_max: 40 });
  check("« impôts l'an dernier »", pick("impôts l’an dernier"), { category: "impots", date_from: "2025-01-01", date_to: "2025-12-31" });

  console.log("\n— Comparateur et liens partenaires");
  const offer = (id: string, category: string, price: number, affiliate: string | null) => ({
    id, category, provider_name: `Op ${id}`, name: id, monthly_price: price, conditions: null,
    url: "https://example.com", affiliate_url: affiliate, checked_at: "2026-10-01",
  });
  const compared = compareOffers(
    [offer("cher", "telecom", 25, null), offer("b", "telecom", 9.99, "https://p.example"), offer("a", "telecom", 5, null)],
    { currentMonthly: 19.99, currentProvider: "Free Mobile" },
  );
  check("seulement les offres moins chères, triées par prix", compared.map((o) => o.id), ["a", "b"]);
  check("lien partenaire signalé en télécom", compared.map((o) => o.sponsored), [false, true]);
  check("économie annuelle", compared[0].yearlySaving, 179.88);
  check(
    "jamais de lien rémunéré en assurance",
    compareOffers([offer("x", "assurance", 10, "https://p.example")], { currentMonthly: 32, currentProvider: "MAIF" })[0].sponsored,
    false,
  );
  check(
    "l'offre du fournisseur actuel n'est pas proposée",
    compareOffers([offer("y", "telecom", 5, null)], { currentMonthly: 19.99, currentProvider: "Op y" }).length,
    0,
  );

  console.log("\n— Surveillance des prix");
  await reset(userId);
  await db.from("profiles").update({ plan: "pro" }).eq("id", userId);
  const bill = (body: string, from = "Netflix <info@account.netflix.com>") => ({
    from,
    subject: "Votre facture",
    date: new Date().toISOString(),
    body,
  });
  const send = async (payload: ReturnType<typeof bill>) =>
    processEmailJob({ id: await job(userId, "email"), user_id: userId, attempts: 0, payload });
  const state = async () => {
    const { data: s } = await db.from("subscriptions").select("id, amount").eq("user_id", userId).eq("provider", "Netflix").single();
    const { data: c } = await db.from("price_changes").select("kind, source, old_amount, new_amount").eq("subscription_id", s!.id).order("created_at");
    const { count: a } = await db.from("alerts").select("id", { count: "exact", head: true }).eq("ref_id", s!.id).eq("kind", "price_change");
    return { amount: Number(s!.amount), changes: (c ?? []).map((x) => `${x.kind}:${x.source}:${x.old_amount}->${x.new_amount}`), alerts: a };
  };

  await send(bill("Montant prélevé : 13,49 € par mois."));
  await send(bill("Montant prélevé : 13,49 € par mois."));
  check("même prix deux fois → rien", await state(), { amount: 13.49, changes: [], alerts: 0 });

  await send(bill("Montant prélevé : 15,49 € par mois."));
  check("facture plus chère → hausse + alerte, nouveau prix retenu", await state(), {
    amount: 15.49, changes: ["increase:invoice:13.49->15.49"], alerts: 1,
  });

  await send(bill("Montant prélevé : 14,49 € par mois."));
  check("facture moins chère → baisse enregistrée, sans alerte", (await state()).changes.at(-1), "decrease:invoice:15.49->14.49");
  check("toujours une seule alerte", (await state()).alerts, 1);

  // Date d'effet toujours à deux mois : le rappel « 7 jours avant » existe.
  const effect = new Date(Date.now() + 60 * 86_400_000);
  const effectFr = `${String(effect.getUTCDate()).padStart(2, "0")}/${String(effect.getUTCMonth() + 1).padStart(2, "0")}/${effect.getUTCFullYear()}`;
  await send(bill(`Votre abonnement par mois passe de 14,49 € à 16,99 € à compter du ${effectFr}.`));
  let st = await state();
  // Hausse annoncée : une alerte tout de suite, une autre 7 jours avant.
  check("annonce de hausse → alerte immédiate + rappel 7 jours avant", { last: st.changes.at(-1), alerts: st.alerts }, { last: "increase:announcement:14.49->16.99", alerts: 3 });
  check("annonce → prix actuel inchangé jusqu'à la date d'effet", st.amount, 14.49);

  await send(bill("Montant prélevé : 16,99 € par mois."));
  st = await state();
  check("1re facture au prix annoncé → pas de doublon, prix mis à jour", { amount: st.amount, n: st.changes.length, alerts: st.alerts }, { amount: 16.99, n: 3, alerts: 3 });

  await send(bill("Montant prélevé : 169,90 € par mois."));
  st = await state();
  check("écart invraisemblable (×10) → ignoré, prix connu conservé", { n: st.changes.length, amount: st.amount }, { n: 3, amount: 16.99 });

  await send(bill("Montant prélevé : 199,00 € par an."));
  check("autre périodicité (annuel) → pas une hausse", (await state()).changes.length, 3);

  const { data: edf } = await db.from("known_providers").select("name, domain, category").eq("name", "EDF").single();
  const edfBill = (amount: string) => bill(`Montant prélevé : ${amount} € par mois.`, `EDF <factures@${edf!.domain}>`);
  await send(edfBill("80,00"));
  await send(edfBill("95,00"));
  const { count: edfChanges } = await db.from("price_changes").select("id", { count: "exact", head: true }).eq("user_id", userId).neq("subscription_id", (await db.from("subscriptions").select("id").eq("user_id", userId).eq("provider", "Netflix").single()).data!.id);
  check(`électricité (catégorie ${edf!.category}) : consommation variable → pas une hausse`, edfChanges, 0);

  console.log("\n— Résiliation détectée dans les e-mails");
  await reset(userId);
  await db.from("profiles").update({ plan: "pro" }).eq("id", userId);
  const dated = (body: string, date: string) => ({ ...bill(body), date });
  const netflixState = async () => {
    const { data: rows } = await db.from("subscriptions").select("id, status, metadata").eq("user_id", userId).eq("provider", "Netflix");
    const row = rows?.[0];
    const { count: deadlines } = await db.from("alerts").select("id", { count: "exact", head: true }).eq("ref_id", row?.id ?? "").eq("kind", "deadline").is("sent_at", null);
    const { count: warnings } = await db.from("alerts").select("id", { count: "exact", head: true }).eq("ref_id", row?.id ?? "").eq("kind", "manual");
    return {
      rows: rows?.length ?? 0,
      status: row?.status,
      end: (row?.metadata as Record<string, unknown> | null)?.cancel_effective_date ?? null,
      deadlines,
      warnings,
    };
  };

  await send(dated("Montant prélevé : 13,49 € par mois. Prochain prélèvement le 15/11/2026.", "2026-10-01T09:00:00Z"));
  check("abonnement actif, rappels programmés", await netflixState(), { rows: 1, status: "active", end: null, deadlines: 2, warnings: 0 });

  await send(dated("Votre résiliation a bien été prise en compte. Votre abonnement prendra fin le 15/11/2026.", "2026-10-03T09:00:00Z"));
  check("confirmation de résiliation → résilié, rappels retirés", await netflixState(), { rows: 1, status: "cancelled", end: "2026-11-15", deadlines: 0, warnings: 0 });

  await send(dated("Montant prélevé : 13,49 € par mois.", "2026-11-10T09:00:00Z"));
  check("dernière facture avant la fin d'accès → ignorée", await netflixState(), { rows: 1, status: "cancelled", end: "2026-11-15", deadlines: 0, warnings: 0 });

  await send(dated("Montant prélevé : 13,49 € par mois.", "2026-12-15T09:00:00Z"));
  const after = await netflixState();
  check("facture après la fin d'accès → suivi repris + alerte, sans doublon", { rows: after.rows, status: after.status, warnings: after.warnings }, { rows: 1, status: "active", warnings: 1 });

  await reset(userId);
  console.log(failures === 0 ? "\nTout est conforme." : `\n${failures} échec(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
