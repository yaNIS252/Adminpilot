import { NextResponse } from "next/server";
import { Resend } from "resend";

import {
  buildDeadlineEmail,
  buildManualEmail,
  buildNoticeEmail,
  buildPriceChangeEmail,
  buildRenewalEmail,
} from "@/lib/alerts/email";
import { sendMonthlyRecaps } from "@/lib/alerts/recap";
import { currentPeriod, incrementUsage } from "@/lib/billing/quotas";
import { sendFeedbackRequests } from "@/lib/feedback";
import { PLAN_LIMITS } from "@/lib/constants";
import { alertsAddress } from "@/lib/email/sender";
import { runReferralTasks } from "@/lib/referral/engine";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Envoi quotidien des alertes arrivées à échéance.
 *
 * `sent_at` est posé AVANT l'envoi. Un doublon vaut mieux qu'un silence
 * inversé : si on marquait après coup, un plantage entre l'envoi et l'écriture
 * ferait repartir le même email à chaque passage du cron. Ici, le pire cas est
 * une alerte perdue — visible dans les logs, et l'utilisateur garde de toute
 * façon l'échéance sous les yeux dans son tableau de bord.
 */

const BATCH_SIZE = 100;

function daysUntil(date: string): number {
  const target = new Date(`${date}T00:00:00Z`).getTime();
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Math.round((target - today) / 86_400_000);
}

/** Adresse d'expédition, alignée sur le domaine d'ingestion configuré. */
function sender(): string {
  return alertsAddress();
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }

  const db = createAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const base = siteUrl();
  const today = new Date().toISOString().slice(0, 10);

  // Récapitulatif mensuel des abonnés, du 1er au 3 du mois. Porté par cette
  // tâche quotidienne plutôt que par une tâche à part : le plan Vercel limite
  // le nombre de tâches planifiées.
  const recap = await sendMonthlyRecaps({ db, resend, from: sender(), siteUrl: base });

  // Parrainage : fin des mois offerts, validation des parrains. Même raison
  // que le récap pour être hébergé ici. Un échec n'empêche pas les alertes.
  const referrals = await runReferralTasks(db).catch((error) => {
    console.error("[cron] parrainage:", error);
    return null;
  });

  // Demande d'avis un mois après l'inscription. Même hébergement que le récap.
  const feedback = await sendFeedbackRequests({ db, resend, siteUrl: base }).catch((error) => {
    console.error("[cron] demande d'avis:", error);
    return null;
  });

  const { data: alerts, error } = await db
    .from("alerts")
    .select("*, profiles!inner(email, deleted_at, plan)")
    .is("sent_at", null)
    .lte("alert_date", today)
    .limit(BATCH_SIZE);

  if (error) throw error;
  if (!alerts?.length) {
    return NextResponse.json({ candidates: 0, sent: 0, failed: 0, refused: 0, recap, referrals, feedback });
  }

  // Les objets référencés sont chargés en deux requêtes, pas en deux par
  // alerte : sur un lot de cent, l'ancienne version en faisait cent et un.
  const subIds = alerts
    .filter((a) => a.ref_type === "subscription")
    .map((a) => a.ref_id);
  const docIds = alerts
    .filter((a) => a.ref_type === "document")
    .map((a) => a.ref_id);

  const [subs, docs] = await Promise.all([
    subIds.length
      ? db
          .from("subscriptions")
          .select(
            "id, user_id, provider, amount, currency, next_renewal, confirmed_by_user, metadata",
          )
          .in("id", subIds)
      : Promise.resolve({ data: [] as never[] }),
    docIds.length
      ? db
          .from("documents")
          .select("id, user_id, filename_ai, filename_original, deadline")
          .in("id", docIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const subById = new Map((subs.data ?? []).map((s) => [s.id, s]));

  // Alertes déjà envoyées ce mois-ci, par utilisateur, pour appliquer le quota
  // des formules limitées. Chargées une fois pour tout le lot, puis tenues à
  // jour en mémoire à chaque envoi.
  const userIds = [...new Set(alerts.map((a) => a.user_id))];
  const { data: counters } = await db
    .from("usage_counters")
    .select("user_id, alerts_count")
    .eq("period", currentPeriod())
    .in("user_id", userIds);
  const sentThisMonth = new Map(
    (counters ?? []).map((c) => [c.user_id, c.alerts_count]),
  );
  const docById = new Map((docs.data ?? []).map((d) => [d.id, d]));

  let sent = 0;
  let failed = 0;
  let refused = 0;
  let capped = 0;

  for (const alert of alerts) {
    const profile = alert.profiles as unknown as {
      email: string;
      deleted_at: string | null;
      plan: keyof typeof PLAN_LIMITS;
    };

    // Clore l'alerte d'abord, dans tous les cas de figure : une alerte qu'on
    // renonce à envoyer ne doit pas être reprise à chaque passage du cron.
    await db
      .from("alerts")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", alert.id);

    // Compte supprimé entre la programmation et l'envoi.
    if (profile.deleted_at) continue;

    // Quota mensuel d'alertes envoyées (3 en gratuit). L'alerte est close sans
    // envoi : la relancer le mois suivant la ferait arriver après l'échéance,
    // ce qui serait pire qu'inutile.
    const limit = PLAN_LIMITS[profile.plan]?.alerts ?? null;
    const already = sentThisMonth.get(alert.user_id) ?? 0;
    if (limit !== null && already >= limit) {
      capped += 1;
      continue;
    }

    try {
      const dashboardUrl = `${base}/dashboard`;
      let email;

      if (alert.ref_type === "subscription") {
        const sub = subById.get(alert.ref_id);

        // Second verrou contre une alerte pointant vers l'objet d'autrui. La
        // route de création vérifie déjà la propriété, mais cette lecture-ci
        // passe par le client de service, qui contourne RLS : si le contrôle
        // amont venait à sauter, c'est ici que la fuite se produirait.
        if (sub && sub.user_id !== alert.user_id) {
          refused += 1;
          continue;
        }

        if (alert.kind === "manual") {
          if (!sub) continue;
          email = buildManualEmail({
            title: alert.title,
            message: alert.message,
            about: sub.provider,
            dashboardUrl: `${base}/abonnements`,
          });
        } else if (alert.kind === "price_change") {
          // Abonnement supprimé depuis la détection : l'alerte n'a plus d'objet.
          if (!sub) continue;
          email = buildPriceChangeEmail({
            title: alert.title,
            message: alert.message,
            cancelUrl: `${base}/abonnements/${sub.id}/resilier`,
          });
        } else {
          // L'abonnement a pu être supprimé ou résilié depuis : plus d'objet,
          // plus d'alerte.
          if (!sub?.next_renewal) continue;

          const ownLine =
            (sub.metadata as { source?: string } | null)?.source === "adminpilot_billing";
          // Titre propre (fin d'essai, fin du mois offert) : son texte à lui,
          // pas le modèle de renouvellement.
          if (alert.title !== `${sub.provider} se renouvelle`) {
            email = buildNoticeEmail({
              title: alert.title,
              message: alert.message,
              label: ownLine ? "Ton abonnement AdminPilot" : "Rappel",
              actionLabel: ownLine ? "Voir les formules" : "Voir mes options",
              actionUrl: ownLine
                ? `${base}/reglages#formules`
                : `${base}/abonnements/${sub.id}/resilier`,
            });
          } else email = buildRenewalEmail({
            provider: sub.provider,
            amount: sub.amount,
            currency: sub.currency,
            renewalDate: sub.next_renewal,
            daysLeft: Math.max(0, daysUntil(sub.next_renewal)),
            dashboardUrl,
            confirmed: sub.confirmed_by_user,
          });
        }
      } else {
        const doc = docById.get(alert.ref_id);

        if (doc && doc.user_id !== alert.user_id) {
          refused += 1;
          continue;
        }
        if (alert.kind === "manual") {
          if (!doc) continue;
          email = buildManualEmail({
            title: alert.title,
            message: alert.message,
            about: doc.filename_ai ?? doc.filename_original,
            dashboardUrl: `${base}/documents`,
          });
        } else {
          if (!doc?.deadline) continue;

          email = buildDeadlineEmail({
            title: doc.filename_ai ?? doc.filename_original,
            deadline: doc.deadline,
            daysLeft: Math.max(0, daysUntil(doc.deadline)),
            dashboardUrl: `${base}/documents`,
          });
        }
      }

      await resend.emails.send({
        from: sender(),
        to: profile.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      sent += 1;
      sentThisMonth.set(alert.user_id, already + 1);
      // Compteur en base, pour les passages suivants et l'affichage du quota.
      await incrementUsage(alert.user_id, "alerts").catch(() => {});
    } catch {
      // Aucun détail loggé : le message d'erreur d'un envoi contient
      // l'adresse du destinataire.
      failed += 1;
    }
  }

  return NextResponse.json({
    candidates: alerts.length,
    sent,
    failed,
    refused,
    capped,
    recap,
    referrals,
    feedback,
  });
}
