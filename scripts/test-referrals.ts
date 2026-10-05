/**
 * Vérifie le parrainage sur la vraie base, avec des comptes jetables
 * `*-<aléa>@adminpilot.test` créés puis supprimés. Aucun e-mail n'est envoyé
 * (clé Resend retirée) et Stripe n'est pas sollicité : les parrains testés
 * sont en gratuit, donc récompensés en mois offert. Développement uniquement.
 *
 * Usage : npm run test:referrals
 */

import { createClient } from "@supabase/supabase-js";

import { REFERRAL } from "../src/lib/constants";
import { forwardingSourceAddress } from "../src/lib/ingest/gmail-confirmation";
import { restoreBonus } from "../src/lib/referral/bonus";
import {
  activateReferral,
  attachReferral,
  recordForwardingSource,
  referralOverview,
  runReferralTasks,
} from "../src/lib/referral/engine";
import { normalizeEmail, refereeLabel } from "../src/lib/referral/normalize";
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

async function user(name: string, email = `${name}-${run}@adminpilot.test`) {
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  const { data: profile } = await db
    .from("profiles")
    .select("id, referral_code")
    .eq("id", data.user.id)
    .single();
  return profile!;
}

async function profile(id: string) {
  const { data } = await db
    .from("profiles")
    .select("plan, bonus_pro_until")
    .eq("id", id)
    .single();
  return data!;
}

async function status(refereeId: string) {
  const { data } = await db
    .from("referrals")
    .select("status, block_reason")
    .eq("referee_id", refereeId)
    .maybeSingle();
  return data ? `${data.status}${data.block_reason ? `:${data.block_reason}` : ""}` : null;
}

/** Abonnement détecté depuis un e-mail transféré. */
async function emailSubscription(userId: string, provider: string) {
  const { data: job, error } = await db
    .from("ingestion_jobs")
    .insert({
      user_id: userId,
      source: "email",
      content_hash: crypto.randomUUID(),
      status: "done",
    })
    .select("id")
    .single();
  if (error) throw error;
  await db.from("subscriptions").insert({
    user_id: userId,
    provider,
    amount: 9.99,
    cycle: "monthly",
    source_job_id: job.id,
  });
}

async function age(userId: string, days: number) {
  await db
    .from("profiles")
    .update({ created_at: new Date(Date.now() - days * 86_400_000).toISOString() })
    .eq("id", userId);
}

async function main() {
  // ------------------------------------------------------------ fonctions pures
  check("normalisation Gmail", normalizeEmail("Jean.Dupont+promo@googlemail.com"), "jeandupont@gmail.com");
  check("normalisation autre domaine", normalizeEmail("jean.dupont+x@orange.fr"), "jean.dupont@orange.fr");
  check("libellé prénom", refereeLabel("Marie Curie", "m@x.fr"), "Marie");
  check("libellé sans prénom", refereeLabel(null, "zoe@x.fr"), "Z•••");
  check(
    "boîte qui transfère (demande Gmail)",
    forwardingSourceAddress(
      "jean.dupont@gmail.com a demandé à transférer automatiquement ses e-mails vers u-abc@in.zylax.fr. Aide : forwarding-noreply@google.com",
      "in.zylax.fr",
    ),
    "jean.dupont@gmail.com",
  );

  // ------------------------------------------------------------ parcours normal
  const parrain = await user("parrain");
  const filleul = await user("filleul");
  await attachReferral({ db, userId: filleul.id, code: parrain.referral_code, ip: "203.0.113.1" });
  check("filleul rattaché", await status(filleul.id), "signed_up");

  await recordForwardingSource(db, filleul.id, "filleul.vrai@gmail.com");
  await activateReferral(db, filleul.id);
  check("transfert en place → en attente", await status(filleul.id), "pending");
  const f1 = await profile(filleul.id);
  check("filleul passe en Pro", f1.plan, "pro");
  const days = Math.round((new Date(f1.bonus_pro_until!).getTime() - Date.now()) / 86_400_000);
  check("mois offert de 30 jours", days, REFERRAL.bonusDays);
  const { data: line } = await db
    .from("subscriptions")
    .select("id, provider, amount, next_renewal")
    .eq("user_id", filleul.id)
    .eq("metadata->>source", "adminpilot_billing")
    .single();
  check("ligne « AdminPilot Pro (offert) » à 0 €", [line?.provider, Number(line?.amount)], ["AdminPilot Pro (offert)", 0]);
  const { count: bonusAlerts } = await db
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("ref_id", line!.id);
  check("rappels de fin du mois offert (J-7, J-1)", bonusAlerts, 2);

  // Compte existant : pas de rattachement.
  const ancien = await user("ancien");
  await age(ancien.id, 3);
  await attachReferral({ db, userId: ancien.id, code: parrain.referral_code, ip: null });
  check("compte existant non rattaché", await status(ancien.id), null);

  // Validation : il faut 2 abonnements par e-mail ET 7 jours.
  await emailSubscription(filleul.id, "Netflix");
  await emailSubscription(filleul.id, "Spotify");
  await runReferralTasks(db);
  check("compte trop récent → toujours en attente", await status(filleul.id), "pending");
  await age(filleul.id, 8);
  await runReferralTasks(db);
  check("2 abonnements + 8 jours → validé", await status(filleul.id), "validated");
  check("parrain gratuit passe en Pro", (await profile(parrain.id)).plan, "pro");

  const overview = await referralOverview(db, parrain.id);
  check("réglages : 1 mois gagné", overview.earned, 1);

  // ------------------------------------------------------------ contrôles anti-abus
  // Variante de l'adresse du parrain.
  const soiMeme = await user("soi", `parrain-${run}+bis@adminpilot.test`);
  await attachReferral({ db, userId: soiMeme.id, code: parrain.referral_code, ip: null });
  await activateReferral(db, soiMeme.id);
  check("variante de sa propre adresse → écarté", await status(soiMeme.id), "blocked:self_email");
  check("aucun mois offert à l'écarté", (await profile(soiMeme.id)).plan, "free");

  // Même boîte Gmail qui alimente déjà un autre compte.
  const doublon = await user("doublon");
  await attachReferral({ db, userId: doublon.id, code: parrain.referral_code, ip: null });
  await recordForwardingSource(db, doublon.id, "Filleul.Vrai+2@gmail.com");
  await activateReferral(db, doublon.id);
  check("même boîte qui transfère → écarté", await status(doublon.id), "blocked:duplicate_source");

  // Le parrain voit « en attente », pas le motif.
  const rows = (await referralOverview(db, parrain.id)).rows;
  check(
    "écartés affichés « en attente »",
    rows.filter((row) => row.status === "pending").length,
    2,
  );

  // Inscriptions en série depuis une même connexion.
  const parrain2 = await user("parrain2");
  const serie: string[] = [];
  for (let i = 0; i < REFERRAL.maxPerIp + 1; i += 1) {
    const f = await user(`serie${i}`);
    await attachReferral({ db, userId: f.id, code: parrain2.referral_code, ip: "198.51.100.7" });
    // Horodatages distincts : l'ordre d'inscription compte.
    await new Promise((resolve) => setTimeout(resolve, 20));
    serie.push(f.id);
  }
  for (const id of serie) await activateReferral(db, id);
  check(`${REFERRAL.maxPerIp} premiers d'une même IP acceptés`, await status(serie[REFERRAL.maxPerIp - 1]!), "pending");
  check(`${REFERRAL.maxPerIp + 1}ᵉ depuis la même IP → écarté`, await status(serie[REFERRAL.maxPerIp]!), "blocked:ip");

  // ------------------------------------------------------------ fin du mois offert
  // Repli : un membre retiré d'un foyer garde son mois offert.
  await db.from("profiles").update({ plan: "free" }).eq("id", filleul.id);
  await restoreBonus(db, [filleul.id]);
  check("mois offert rétabli après repli en gratuit", (await profile(filleul.id)).plan, "pro");

  await db
    .from("profiles")
    .update({ bonus_pro_until: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", filleul.id);
  await runReferralTasks(db);
  const fin = await profile(filleul.id);
  check("mois écoulé → retour en gratuit", [fin.plan, fin.bonus_pro_until], ["free", null]);
  const { count: lineLeft } = await db
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", filleul.id)
    .eq("metadata->>source", "adminpilot_billing");
  check("ligne offerte retirée à la fin du mois", lineLeft, 0);
}

main()
  .catch((error) => {
    failures += 1;
    console.error(error);
  })
  .finally(async () => {
    for (const id of created) await db.auth.admin.deleteUser(id);
    console.log(failures ? `\n${failures} échec(s)` : "\nTout est bon.");
    process.exit(failures ? 1 : 0);
  });
