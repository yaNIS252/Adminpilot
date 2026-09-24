import { NextResponse } from "next/server";
import { Resend } from "resend";

import { buildDeadlineEmail, buildRenewalEmail } from "@/lib/alerts/email";
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

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }

  const db = createAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adminpilot.zylax.fr";
  const today = new Date().toISOString().slice(0, 10);

  const { data: alerts, error } = await db
    .from("alerts")
    .select("*, profiles!inner(email, deleted_at)")
    .is("sent_at", null)
    .lte("alert_date", today)
    .limit(BATCH_SIZE);

  if (error) throw error;

  let sent = 0;
  let failed = 0;

  for (const alert of alerts ?? []) {
    const profile = alert.profiles as unknown as {
      email: string;
      deleted_at: string | null;
    };

    // Compte supprimé entre la programmation et l'envoi : ne rien envoyer,
    // mais clore l'alerte pour qu'elle ne soit pas reprise indéfiniment.
    if (profile.deleted_at) {
      await db
        .from("alerts")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", alert.id);
      continue;
    }

    await db
      .from("alerts")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", alert.id);

    try {
      const dashboardUrl = `${siteUrl}/dashboard`;
      let email;

      if (alert.ref_type === "subscription") {
        const { data: sub } = await db
          .from("subscriptions")
          .select("provider, amount, currency, next_renewal, confirmed_by_user")
          .eq("id", alert.ref_id)
          .maybeSingle();

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
        const { data: doc } = await db
          .from("documents")
          .select("filename_ai, filename_original, deadline")
          .eq("id", alert.ref_id)
          .maybeSingle();

        if (!doc?.deadline) continue;

        email = buildDeadlineEmail({
          title: doc.filename_ai ?? doc.filename_original,
          deadline: doc.deadline,
          daysLeft: Math.max(0, daysUntil(doc.deadline)),
          dashboardUrl: `${siteUrl}/documents`,
        });
      }

      await resend.emails.send({
        from: "AdminPilot <alertes@in.zylax.fr>",
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

  return NextResponse.json({ candidates: alerts?.length ?? 0, sent, failed });
}
