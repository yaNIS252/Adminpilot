import "server-only";

import type Stripe from "stripe";

import { getStripe } from "@/lib/billing/stripe";
import { coveredByHousehold, unlockHiddenSubscriptions } from "@/lib/billing/sync";
import { PLAN_PRICES, REFERRAL } from "@/lib/constants";
import { bonusActive } from "@/lib/referral/bonus";
import { removeBonusLine, syncBonusLine } from "@/lib/referral/bonus-line";
import { sendReferralValidated } from "@/lib/referral/email";
import { fingerprint, normalizeEmail, refereeLabel } from "@/lib/referral/normalize";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";

/**
 * Parrainage — cycle de vie d'un filleul.
 *
 *   signed_up → inscrit par le lien, transfert pas encore en place
 *   pending   → transfert en place : le filleul a son mois de Pro, le parrain
 *               attend que le filleul s'en serve vraiment
 *   validated → le filleul a des abonnements détectés depuis ses e-mails et un
 *               compte d'au moins une semaine, ou il paie : le parrain a son mois
 *   capped    → validé, mais le parrain a déjà reçu le plafond de mois offerts
 *   blocked   → écarté par un contrôle anti-abus
 *
 * Un filleul écarté n'est jamais prévenu, et le parrain voit « en attente » :
 * dire précisément quel contrôle a joué apprendrait à le contourner. Les
 * conditions elles-mêmes sont publiques, dans les CGU.
 */

type Db = ReturnType<typeof createAdminClient>;
type Referral = Tables<"referrals">;

const DAY_MS = 86_400_000;

/** Un compte n'est rattaché à un parrain que s'il vient d'être créé. */
const NEW_ACCOUNT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Rattache un compte tout juste créé au parrain dont le lien a été suivi.
 * Appelé au retour du lien de connexion ; sans effet pour un compte existant
 * ou déjà rattaché.
 */
export async function attachReferral(input: {
  db: Db;
  userId: string;
  code: string;
  ip: string | null;
}) {
  const { db, userId } = input;
  const code = input.code.trim().toLowerCase();
  if (!/^[a-z0-9]{6,32}$/.test(code)) return;

  const [{ data: referrer }, { data: referee }] = await Promise.all([
    db
      .from("profiles")
      .select("id")
      .eq("referral_code", code)
      .is("deleted_at", null)
      .maybeSingle(),
    db.from("profiles").select("id, email, created_at").eq("id", userId).maybeSingle(),
  ]);
  if (!referrer || !referee || referrer.id === referee.id) return;
  if (Date.now() - new Date(referee.created_at).getTime() > NEW_ACCOUNT_WINDOW_MS) return;

  await db.from("referrals").upsert(
    {
      referrer_id: referrer.id,
      referee_id: referee.id,
      referee_email_norm: normalizeEmail(referee.email),
      ip_hash: input.ip ? fingerprint(`ip:${input.ip}`) : null,
    },
    { onConflict: "referee_id", ignoreDuplicates: true },
  );
}

/** Mémorise l'empreinte de la boîte qui transfère, lue dans la demande Gmail. */
export async function recordForwardingSource(db: Db, userId: string, address: string) {
  await db
    .from("profiles")
    .update({ forwarding_source_hash: fingerprint(`mail:${normalizeEmail(address)}`) })
    .eq("id", userId);
}

/**
 * Le transfert du filleul fonctionne (code Gmail reçu ou premier e-mail
 * transféré) : il reçoit son mois de Pro, sauf si un contrôle l'écarte.
 */
export async function activateReferral(db: Db, userId: string) {
  const { data: referral } = await db
    .from("referrals")
    .select("*")
    .eq("referee_id", userId)
    .eq("status", "signed_up")
    .maybeSingle();
  if (!referral) return;

  const now = new Date().toISOString();
  const reason = await abuseReason(db, referral);
  if (reason) {
    await db
      .from("referrals")
      .update({ status: "blocked", block_reason: reason, activated_at: now })
      .eq("id", referral.id);
    return;
  }

  await grantBonus(db, userId);
  await db
    .from("referrals")
    .update({ status: "pending", activated_at: now })
    .eq("id", referral.id)
    .eq("status", "signed_up");
}

/**
 * Le filleul vient de payer un abonnement (hors période d'essai et hors code
 * à 100 %) : client réel, le parrain est validé sans attendre.
 */
export async function onRefereePaid(db: Db, userId: string, subscription: Stripe.Subscription) {
  const { data: referral } = await db
    .from("referrals")
    .select("*")
    .eq("referee_id", userId)
    .in("status", ["signed_up", "pending"])
    .maybeSingle();
  if (!referral) return;

  if (await sameCardAsReferrer(db, referral.referrer_id, subscription)) {
    await db
      .from("referrals")
      .update({ status: "blocked", block_reason: "same_card" })
      .eq("id", referral.id);
    return;
  }
  await validateReferral(db, referral);
}

/**
 * Tâche quotidienne : fin des mois offerts, validation des parrains dont le
 * filleul remplit désormais les conditions.
 */
export async function runReferralTasks(db: Db) {
  const now = new Date();

  // 1. Mois offerts arrivés à terme.
  const { data: expiring, error } = await db
    .from("profiles")
    .select("id, plan")
    .not("bonus_pro_until", "is", null)
    .lte("bonus_pro_until", now.toISOString())
    .limit(200);
  if (error) throw error;

  let expired = 0;
  for (const profile of expiring ?? []) {
    const update: { bonus_pro_until: null; plan?: "free" | "family"; updated_at: string } = {
      bonus_pro_until: null,
      updated_at: now.toISOString(),
    };
    // Seul un Pro sans abonnement tient du parrainage (l'abonnement efface la
    // date) ; un membre de foyer garde Premium.
    if (profile.plan === "pro") {
      update.plan = (await coveredByHousehold(db, profile.id)) ? "family" : "free";
      expired += 1;
    }
    await db.from("profiles").update(update).eq("id", profile.id);
    await removeBonusLine(db, profile.id);
  }

  // 2. Parrains à valider : filleul actif depuis au moins une semaine.
  const { data: pending } = await db
    .from("referrals")
    .select("*, referee:profiles!referrals_referee_id_fkey(created_at)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);

  let validated = 0;
  for (const row of pending ?? []) {
    const { referee, ...referral } = row;
    if (!referee) continue;
    const age = now.getTime() - new Date(referee.created_at).getTime();
    if (age < REFERRAL.minAgeDays * DAY_MS) continue;
    if ((await emailDetectedSubscriptions(db, referral.referee_id)) < REFERRAL.minSubscriptions) {
      continue;
    }
    if (await validateReferral(db, referral)) validated += 1;
  }

  return { expired, validated };
}

/** Résumé affiché au parrain dans ses réglages. */
export async function referralOverview(db: Db, userId: string) {
  const { data, error } = await db
    .from("referrals")
    .select("id, status, created_at, referee:profiles!referrals_referee_id_fkey(name, email)")
    .eq("referrer_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    label: row.referee ? refereeLabel(row.referee.name, row.referee.email) : "Compte supprimé",
    // Un filleul écarté s'affiche « en attente », comme décrit plus haut.
    status:
      row.status === "signed_up"
        ? ("signed_up" as const)
        : row.status === "validated"
          ? ("validated" as const)
          : row.status === "capped"
            ? ("capped" as const)
            : ("pending" as const),
    createdAt: row.created_at,
  }));

  return {
    rows,
    earned: rows.filter((row) => row.status === "validated").length,
  };
}

// ---------------------------------------------------------------- interne

/**
 * Accorde un mois de Pro, ajouté à la suite d'un mois déjà en cours. Un compte
 * déjà payant ou en foyer garde sa formule ; la date ne sert alors qu'au jour
 * où il retomberait en gratuit.
 */
async function grantBonus(db: Db, userId: string): Promise<Date | null> {
  const { data: profile } = await db
    .from("profiles")
    .select("plan, bonus_pro_until")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  const now = Date.now();
  const current = profile.bonus_pro_until ? new Date(profile.bonus_pro_until).getTime() : 0;
  const until = new Date(Math.max(now, current) + REFERRAL.bonusDays * DAY_MS);

  await db
    .from("profiles")
    .update({
      bonus_pro_until: until.toISOString(),
      ...(profile.plan === "free" ? { plan: "pro" as const } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profile.plan === "free") await unlockHiddenSubscriptions(db, userId);
  // Pro offert à un compte sans abonnement : la ligne AdminPilot et ses
  // rappels de fin. Un membre de foyer garde Premium, rien à afficher.
  if (profile.plan === "free" || bonusActive(profile)) await syncBonusLine(db, userId, until);
  return until;
}

/**
 * Récompense le parrain. Abonné payant : crédit Stripe d'un mois de Pro,
 * déduit de sa prochaine facture. Sinon : un mois de Pro offert.
 */
async function rewardReferrer(
  db: Db,
  referrerId: string,
): Promise<{ reward: "bonus" | "credit"; until: Date | null } | null> {
  const { data: profile } = await db
    .from("profiles")
    .select("plan, bonus_pro_until, stripe_sub_id, stripe_customer_id")
    .eq("id", referrerId)
    .maybeSingle();
  if (!profile) return null;

  if (
    profile.plan !== "free" &&
    !bonusActive(profile) &&
    profile.stripe_sub_id &&
    profile.stripe_customer_id
  ) {
    try {
      const subscription = await getStripe().subscriptions.retrieve(profile.stripe_sub_id);
      if (subscription.status === "active" || subscription.status === "trialing") {
        await getStripe().customers.createBalanceTransaction(profile.stripe_customer_id, {
          amount: -Math.round(PLAN_PRICES.pro.monthly * 100),
          currency: "eur",
          description: "Parrainage : un mois offert",
        });
        return { reward: "credit", until: null };
      }
    } catch (error) {
      console.error("[referral] crédit Stripe impossible, mois offert à la place", error);
    }
  }

  return { reward: "bonus", until: await grantBonus(db, referrerId) };
}

/** Valide un parrainage et récompense le parrain. Vrai si récompensé. */
async function validateReferral(db: Db, referral: Referral): Promise<boolean> {
  const now = new Date().toISOString();

  // Contrôles rejoués : la boîte qui transfère, par exemple, n'était peut-être
  // pas encore connue à l'inscription.
  const reason = await abuseReason(db, referral);
  if (reason) {
    await db
      .from("referrals")
      .update({ status: "blocked", block_reason: reason })
      .eq("id", referral.id);
    return false;
  }

  const { count } = await db
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referral.referrer_id)
    .eq("status", "validated");
  if ((count ?? 0) >= REFERRAL.maxMonths) {
    await db
      .from("referrals")
      .update({ status: "capped", validated_at: now })
      .eq("id", referral.id);
    return false;
  }

  // Statut posé avant la récompense, et seulement s'il n'a pas changé : deux
  // passages simultanés (cron et paiement) ne récompensent qu'une fois.
  const { data: claimed } = await db
    .from("referrals")
    .update({ status: "validated", validated_at: now })
    .eq("id", referral.id)
    .in("status", ["signed_up", "pending"])
    .select("id");
  if (!claimed?.length) return false;

  const result = await rewardReferrer(db, referral.referrer_id);
  if (!result) return false;
  await db
    .from("referrals")
    .update({ referrer_reward: result.reward })
    .eq("id", referral.id);

  const [{ data: referrer }, { data: referee }] = await Promise.all([
    db.from("profiles").select("email").eq("id", referral.referrer_id).maybeSingle(),
    db.from("profiles").select("name, email").eq("id", referral.referee_id).maybeSingle(),
  ]);
  if (referrer && referee) {
    await sendReferralValidated({
      to: referrer.email,
      refereeLabel: refereeLabel(referee.name, referee.email),
      reward: result.reward,
      bonusUntil: result.until,
    });
  }
  return true;
}

/** Motif d'exclusion du parrainage, ou `null`. */
async function abuseReason(db: Db, referral: Referral): Promise<string | null> {
  const [{ data: referrer }, { data: referee }] = await Promise.all([
    db
      .from("profiles")
      .select("email, forwarding_source_hash")
      .eq("id", referral.referrer_id)
      .maybeSingle(),
    db
      .from("profiles")
      .select("forwarding_source_hash, created_at")
      .eq("id", referral.referee_id)
      .maybeSingle(),
  ]);
  if (!referrer || !referee) return "missing_profile";

  // Même boîte, sous une variante d'adresse.
  if (normalizeEmail(referrer.email) === referral.referee_email_norm) return "self_email";
  const { count: sameEmail } = await db
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referee_email_norm", referral.referee_email_norm)
    .neq("id", referral.id)
    // Seuls les comptes antérieurs comptent : le premier inscrit reste valable.
    .lt("created_at", referral.created_at);
  if (sameEmail) return "duplicate_email";

  // Même boîte Gmail qui alimente deux comptes.
  const source = referee.forwarding_source_hash;
  if (source) {
    if (source === referrer.forwarding_source_hash) return "self_source";
    const { count: sameSource } = await db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("forwarding_source_hash", source)
      .neq("id", referral.referee_id)
      .lt("created_at", referee.created_at);
    if (sameSource) return "duplicate_source";
  }

  // Trop d'inscriptions parrainées depuis la même connexion.
  if (referral.ip_hash) {
    const { count: sameIp } = await db
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", referral.ip_hash)
      .neq("id", referral.id)
      .lt("created_at", referral.created_at)
      .gte("created_at", new Date(Date.now() - REFERRAL.ipRetentionDays * DAY_MS).toISOString());
    if ((sameIp ?? 0) >= REFERRAL.maxPerIp) return "ip";
  }

  // Parrain et filleul dans le même foyer.
  const { count: sameHousehold } = await db
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .or(
      `and(owner_id.eq.${referral.referrer_id},member_id.eq.${referral.referee_id}),and(owner_id.eq.${referral.referee_id},member_id.eq.${referral.referrer_id})`,
    );
  if (sameHousehold) return "household";

  return null;
}

/**
 * Abonnements trouvés dans les e-mails transférés du filleul : ni saisie à la
 * main, ni dépôt de fichier, ni la ligne AdminPilot elle-même.
 */
async function emailDetectedSubscriptions(db: Db, userId: string): Promise<number> {
  const { data: subs } = await db
    .from("subscriptions")
    .select("source_job_id")
    .eq("user_id", userId)
    .not("source_job_id", "is", null);
  const jobIds = (subs ?? [])
    .map((sub) => sub.source_job_id)
    .filter((id): id is string => Boolean(id));
  if (jobIds.length === 0) return 0;

  const { count } = await db
    .from("ingestion_jobs")
    .select("id", { count: "exact", head: true })
    .in("id", jobIds)
    .eq("source", "email");
  return count ?? 0;
}

/** Vrai si le filleul paie avec une carte déjà enregistrée chez le parrain. */
async function sameCardAsReferrer(
  db: Db,
  referrerId: string,
  subscription: Stripe.Subscription,
): Promise<boolean> {
  const { data: referrer } = await db
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", referrerId)
    .maybeSingle();
  if (!referrer?.stripe_customer_id) return false;

  try {
    const stripe = getStripe();
    const method = subscription.default_payment_method;
    const methodId = typeof method === "string" ? method : method?.id;
    if (!methodId) return false;
    const card = (await stripe.paymentMethods.retrieve(methodId)).card?.fingerprint;
    if (!card) return false;

    const theirs = await stripe.paymentMethods.list({
      customer: referrer.stripe_customer_id,
      type: "card",
      limit: 20,
    });
    return theirs.data.some((pm) => pm.card?.fingerprint === card);
  } catch {
    return false;
  }
}
