import { NextResponse } from "next/server";
import { Resend } from "resend";

import { buildDeadlineEmail, buildRenewalEmail } from "@/lib/alerts/email";
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
  const domain = process.env.INBOUND_DOMAIN ?? "in.zylax.fr";
  return `AdminPilot <alertes@${domain}>`;
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

  const { data: alerts, error } = await db
    .from("alerts")
    .select("*, profiles!inner(email, deleted_at)")
    .is("sent_at", null)
    .lte("alert_date", today)
    .limit(BATCH_SIZE);

  if (error) throw error;
  if (!alerts?.length) {
    return NextResponse.json({ candidates: 0, sent: 0, failed: 0, refused: 0 });
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
            "id, user_id, provider, amount, currency, next_renewal, confirmed_by_user",
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
  const docById = new Map((docs.data ?? []).map((d) => [d.id, d]));

  let sent = 0;
  let failed = 0;
  let refused = 0;

  for (const alert of alerts) {
    const profile = alert.profiles as unknown as {
      email: string;
      deleted_at: string | null;
    };

    // Clore l'alerte d'abord, dans tous les cas de figure : une alerte qu'on
    // renonce à envoyer ne doit pas être reprise à chaque passage du cron.
    await db
      .from("alerts")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", alert.id);

    // Compte supprimé entre la programmation et l'envoi.
    if (profile.deleted_at) continue;

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

        // L'abonnement a pu être supprimé ou résilié depuis : plus d'objet,
        // plus d'alerte.
        if (!sub?.next_renewal) continue;

        email = buildRenewalEmail({
          provider: sub.provider,
          amount: sub.amount,
          currency: sub.currency,
          renewalDate: sub.next_renewal,
          daysLeft: Math.max(0, daysUntil(sub.next_renewal)),
          dashboardUrl,
          confirmed: sub.confirmed_by_user,
        });
      } else {
        const doc = docById.get(alert.ref_id);

        if (doc && doc.user_id !== alert.user_id) {
          refused += 1;
          continue;
        }
        if (!doc?.deadline) continue;

        email = buildDeadlineEmail({
          title: doc.filename_ai ?? doc.filename_original,
          deadline: doc.deadline,
          daysLeft: Math.max(0, daysUntil(doc.deadline)),
          dashboardUrl: `${base}/documents`,
        });
      }

      await resend.emails.send({
        from: sender(),
        to: profile.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      sent += 1;
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
  });
}
