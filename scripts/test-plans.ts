/**
 * Vérifie sur la vraie base, avec des comptes jetables `*@adminpilot.test`
 * créés puis supprimés : l'essai Pro de 14 jours, le retour en gratuit
 * (abonnements remis en réserve), les boîtes mail par formule et les
 * doublons du foyer. Aucun e-mail envoyé, Stripe non sollicité.
 *
 * Usage : npm run test:plans
 */

import { createClient } from "@supabase/supabase-js";

import { enforceFreeLimits } from "../src/lib/billing/limits";
import { startTrialIfNew } from "../src/lib/billing/trial";
import { householdDuplicates } from "../src/lib/household-duplicates";
import { registerMailbox } from "../src/lib/mailboxes";
import { runReferralTasks } from "../src/lib/referral/engine";
import type { Database } from "../src/lib/supabase/types";

delete process.env.RESEND_API_KEY;

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

const run = Math.random().toString(36).slice(2, 8);
const created: string[] = [];

async function user(name: string) {
  const { data, error } = await db.auth.admin.createUser({
    email: `${name}-${run}@adminpilot.test`,
    email_confirm: true,
  });
  if (error) throw error;
  created.push(data.user.id);
  return data.user.id;
}

async function addSubs(userId: string, providers: string[]) {
  for (const [index, provider] of providers.entries()) {
    const { error } = await db.from("subscriptions").insert({
      user_id: userId,
      provider,
      amount: 10,
      cycle: "monthly",
      category: "streaming",
      status: "active",
      confidence: 1,
      confirmed_by_user: true,
      detected_at: new Date(Date.now() - (100 - index) * 60_000).toISOString(),
      metadata: { source: "manual" },
    });
    if (error) throw error;
  }
}

async function state(userId: string) {
  const [{ data: profile }, { data: subs }] = await Promise.all([
    db.from("profiles").select("plan, bonus_pro_until, trial_started_at").eq("id", userId).single(),
    db.from("subscriptions").select("provider, over_quota, metadata").eq("user_id", userId),
  ]);
  const real = (subs ?? []).filter((s) => (s.metadata as { source?: string } | null)?.source === "manual");
  return {
    plan: profile!.plan,
    trial: Boolean(profile!.trial_started_at),
    bonus: Boolean(profile!.bonus_pro_until),
    visibles: real.filter((s) => !s.over_quota).length,
    masques: real.filter((s) => s.over_quota).length,
    ligneOfferte: (subs ?? []).some((s) => (s.metadata as { bonus?: boolean } | null)?.bonus),
  };
}

async function main() {
  console.log("— Essai Pro de 14 jours");
  const a = await user("essai");
  check("nouveau compte → gratuit, sans essai", await state(a), { plan: "free", trial: false, bonus: false, visibles: 0, masques: 0, ligneOfferte: false });
  check("première connexion → essai accordé", await startTrialIfNew(db, a), true);
  check("compte en Pro, ligne offerte créée", await state(a), { plan: "pro", trial: true, bonus: true, visibles: 0, masques: 0, ligneOfferte: true });
  check("seconde connexion → pas de second essai", await startTrialIfNew(db, a), false);

  const { data: reminders } = await db.from("alerts").select("alert_date").eq("user_id", a).is("sent_at", null);
  check("rappels de fin d'essai programmés (7 jours et veille)", reminders?.length, 2);

  console.log("\n— Fin de l'essai : retour en gratuit");
  await addSubs(a, ["Un", "Deux", "Trois", "Quatre", "Cinq", "Six", "Sept", "Huit"]);
  check("pendant l'essai : 8 abonnements visibles", (await state(a)).visibles, 8);
  await db.from("profiles").update({ bonus_pro_until: new Date(Date.now() - 60_000).toISOString() }).eq("id", a);
  await runReferralTasks(db);
  check("essai terminé → gratuit, 5 visibles, 3 en réserve, ligne offerte retirée", await state(a), { plan: "free", trial: true, bonus: false, visibles: 5, masques: 3, ligneOfferte: false });
  const { data: kept } = await db.from("subscriptions").select("provider").eq("user_id", a).eq("over_quota", false).order("detected_at");
  check("les 5 premiers détectés restent visibles", kept?.map((s) => s.provider), ["Un", "Deux", "Trois", "Quatre", "Cinq"]);
  check("après la fin : pas de nouvel essai", await startTrialIfNew(db, a), false);
  check("déjà à la limite : rien de plus à masquer", await enforceFreeLimits(db, a), 0);

  console.log("\n— Boîtes mail par formule");
  const free = { id: a, plan: "free" as const };
  check("gratuit : 1re boîte acceptée", await registerMailbox(db, free, "Perso@gmail.com"), true);
  check("gratuit : même boîte (autre casse) reconnue", await registerMailbox(db, free, "perso@gmail.com"), true);
  check("gratuit : 2e boîte refusée", await registerMailbox(db, free, "travail@gmail.com"), false);
  const premium = { id: a, plan: "family" as const };
  check("Premium : 2e boîte acceptée", await registerMailbox(db, premium, "travail@gmail.com"), true);
  check("Premium : 3e boîte acceptée", await registerMailbox(db, premium, "ancienne@gmail.com"), true);
  check("Premium : 4e boîte refusée", await registerMailbox(db, premium, "quatre@gmail.com"), false);

  console.log("\n— Doublons du foyer");
  const owner = await user("titulaire");
  const member = await user("membre");
  const third = await user("tiers");
  await db.from("profiles").update({ plan: "family" }).in("id", [owner, member, third]);
  await db.from("family_members").insert([
    { owner_id: owner, email: `membre-${run}@adminpilot.test`, member_id: member, joined_at: new Date().toISOString() },
    { owner_id: owner, email: `tiers-${run}@adminpilot.test`, member_id: third, joined_at: new Date().toISOString() },
  ]);
  await addSubs(owner, ["Spotify", "Netflix"]);
  await addSubs(member, ["Spotify Premium", "Deezer"]);
  await addSubs(third, ["Netflix"]);

  check("personne n'a accepté → aucun doublon montré", (await householdDuplicates(db, owner)).duplicates.length, 0);
  await db.from("profiles").update({ household_share: true }).in("id", [owner, member]);
  const seen = await householdDuplicates(db, owner);
  check("deux volontaires → Spotify en double (20 €/mois à deux)", seen.duplicates.map((d) => [d.provider, d.payers, d.totalMonthly]), [["Spotify", 2, 20]]);
  check("le membre qui n'a pas accepté n'est pas comparé (Netflix absent)", seen.duplicates.some((d) => d.provider === "Netflix"), false);
  check("vu du membre : le même doublon", (await householdDuplicates(db, member)).duplicates.map((d) => d.payers), [2]);
  check("vu du tiers non volontaire : rien", (await householdDuplicates(db, third)).duplicates.length, 0);
}

main()
  .catch((error) => {
    failures += 1;
    console.error(error);
  })
  .finally(async () => {
    for (const id of created) await db.auth.admin.deleteUser(id).catch(() => undefined);
    console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
    process.exit(failures === 0 ? 0 : 1);
  });
