import { NextResponse } from "next/server";
import { Resend } from "resend";
import { Webhook } from "svix";
import { z } from "zod";

import { isSenderAddress, senderAddress } from "@/lib/email/sender";
import { hashEmail } from "@/lib/ingest/dedupe";
import {
  detectGmailConfirmation,
  forwardingSourceAddress,
} from "@/lib/ingest/gmail-confirmation";
import { enqueue } from "@/lib/ingest/pipeline";
import { ingestAttachments } from "@/lib/ingest/attachments";
import { isOwnMessage } from "@/lib/ingest/sender-learning";
import { isSecurityEmail } from "@/lib/ingest/sensitive";
import { consume, tooManyRequests } from "@/lib/rate-limit";
import { activateReferral, recordForwardingSource } from "@/lib/referral/engine";
import { buildKey, uploadRaw } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Réception des emails transférés — webhook Resend `email.received`.
 *
 * Remplace le Worker Cloudflare : Resend reçoit sur de simples enregistrements
 * MX, sans migration de zone DNS. Le domaine de production reste intact.
 *
 * Particularité importante : **le webhook ne contient pas le corps de l'email**,
 * seulement des métadonnées et un `email_id`. Le contenu se récupère par un
 * second appel. C'est plutôt une bonne chose — le webhook reste minuscule et
 * répond vite, ce qui évite les réémissions de Resend.
 */

const EventSchema = z.object({
  type: z.string(),
  data: z.object({
    email_id: z.string(),
    from: z.string(),
    to: z.array(z.string()),
    received_for: z.array(z.string()).default([]),
    subject: z.string().default(""),
    message_id: z.string().nullable().default(null),
    created_at: z.string(),
  }),
});

/** Extrait le jeton de `u-<token>@in.domaine`. */
function parseInboxToken(address: string): string | null {
  const local = address.trim().toLowerCase().split("@")[0];
  return /^u-([a-z0-9]+)$/.exec(local ?? "")?.[1] ?? null;
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook non configuré" }, { status: 500 });
  }

  // Le corps BRUT est indispensable : un JSON.parse suivi d'un re-stringify
  // invaliderait la signature.
  const rawBody = await request.text();

  try {
    new Webhook(secret).verify(rawBody, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    });
  } catch {
    return NextResponse.json({ error: "signature invalide" }, { status: 401 });
  }

  const parsed = EventSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return NextResponse.json({ error: "charge utile invalide" }, { status: 400 });
  }

  const event = parsed.data;
  if (event.type !== "email.received") {
    // Acquitté sans traitement : renvoyer une erreur ferait réessayer Resend
    // indéfiniment pour un événement qui ne nous concerne pas.
    return NextResponse.json({ ignored: event.type });
  }

  // `received_for` porte l'adresse d'origine quand le message a été transféré ;
  // `to` la porte dans le cas direct. Les deux doivent être examinées.
  const token = [...event.data.received_for, ...event.data.to]
    .map(parseInboxToken)
    .find((value): value is string => Boolean(value));

  if (!token) {
    // Réponse d'un utilisateur à l'un de nos e-mails (bonjour@, alertes@…) :
    // relayée vers la boîte du support si elle est configurée. Acquittée
    // dans tous les cas, pour que Resend ne réessaie pas.
    const recipients = [...event.data.received_for, ...event.data.to];
    if (recipients.some(isSenderAddress)) {
      await relayToSupport(event.data.email_id, event.data.from, event.data.subject);
      return NextResponse.json({ status: "relayed" }, { status: 202 });
    }
    return NextResponse.json({ error: "destinataire inconnu" }, { status: 404 });
  }

  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("id, plan")
    .eq("inbox_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (!profile) {
    // Réponse identique à celle d'un jeton malformé : un attaquant ne doit pas
    // pouvoir énumérer les jetons valides.
    return NextResponse.json({ error: "destinataire inconnu" }, { status: 404 });
  }

  // Second appel : le contenu de l'email.
  const resend = new Resend(process.env.RESEND_API_KEY);
  const received = await resend.emails.receiving.get(event.data.email_id);

  if (received.error || !received.data) {
    // Erreur remontée pour que Resend réémette : l'email existe, c'est la
    // récupération qui a échoué.
    return NextResponse.json({ error: "email illisible" }, { status: 502 });
  }

  const body = received.data.text || received.data.html || "";

  // Cas prioritaire : le code de validation du transfert Gmail. Ce n'est pas un
  // document à classer, c'est la clé de l'onboarding — traité en synchrone pour
  // apparaître à l'écran sans attendre le drain.
  const confirmation = detectGmailConfirmation({
    from: event.data.from,
    subject: event.data.subject,
    body,
  });

  if (confirmation) {
    await db
      .from("profiles")
      .update({
        gmail_confirmation: confirmation,
        gmail_confirmation_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    // La demande de Gmail prouve une vraie boîte derrière le compte : c'est
    // le moment où un filleul reçoit son mois offert. Un échec ici ne doit
    // pas empêcher le code de s'afficher.
    try {
      const source = forwardingSourceAddress(
        body,
        process.env.INBOUND_DOMAIN ?? "in.zylax.fr",
      );
      if (source) await recordForwardingSource(db, profile.id, source);
      await activateReferral(db, profile.id);
    } catch (error) {
      console.error("[inbound] parrainage:", error);
    }

    return NextResponse.json({ status: "gmail_confirmation" }, { status: 202 });
  }

  // Nos propres e-mails (rappels, reçu Stripe d'AdminPilot) renvoyés par un
  // filtre : ignorés, l'abonnement AdminPilot est suivi depuis Stripe.
  if (isOwnMessage({ from: event.data.from, subject: event.data.subject, body })) {
    return NextResponse.json({ status: "ignored_own" }, { status: 202 });
  }

  // Code de connexion, alerte de sécurité : refusé sans être stocké.
  if (isSecurityEmail(event.data.subject)) {
    return NextResponse.json({ status: "ignored_security" }, { status: 202 });
  }

  if (!(await consume("inbound", token))) {
    return tooManyRequests("inbound");
  }

  const contentHash = hashEmail({
    messageId: event.data.message_id,
    from: event.data.from,
    subject: event.data.subject,
    body,
  });

  const key = buildKey({
    userId: profile.id,
    source: "email",
    contentHash,
    extension: "json",
  });

  await uploadRaw({
    key,
    body: JSON.stringify({
      from: event.data.from,
      subject: event.data.subject,
      date: event.data.created_at,
      body,
    }),
    contentType: "application/json",
  });

  const result = await enqueue({
    userId: profile.id,
    source: "email",
    contentHash,
    rawUrl: key,
    mimeType: "message/rfc822",
  });

  // Factures jointes (PDF) : chacune devient un document rangé, comme un
  // dépôt manuel. Seulement pour un nouvel e-mail, pas un renvoi.
  if (result.status !== "duplicate" && received.data.attachments?.length) {
    await ingestAttachments({
      resend,
      emailId: event.data.email_id,
      userId: profile.id,
      plan: profile.plan,
      attachments: received.data.attachments,
    });
  }

  // Messageries sans demande de validation (règles Outlook, etc.) : le
  // premier e-mail transféré prouve, lui aussi, que le transfert fonctionne.
  await activateReferral(db, profile.id).catch((error) =>
    console.error("[inbound] parrainage:", error),
  );

  // Réveil immédiat du drain. Échec sans conséquence : le cron rattrapera.
  void fetch(new URL("/api/cron/process-jobs", request.url), {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  }).catch(() => {});

  return NextResponse.json(result, { status: 202 });
}

/**
 * Relaie vers `SUPPORT_FORWARD_TO` un message adressé à l'une de nos adresses
 * d'expédition, avec l'expéditeur d'origine en adresse de réponse. Ne lève
 * pas : un relais manqué ne doit pas faire réémettre le webhook.
 */
async function relayToSupport(emailId: string, from: string, subject: string) {
  const to = process.env.SUPPORT_FORWARD_TO?.trim();
  if (!to || !process.env.RESEND_API_KEY) return;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const received = await resend.emails.receiving.get(emailId);
    if (received.error || !received.data) return;
    await resend.emails.send({
      from: senderAddress(),
      to,
      replyTo: from,
      subject: `[Réponse reçue] ${subject}`.slice(0, 200),
      text: `De : ${from}

${received.data.text ?? ""}`,
      ...(received.data.html ? { html: received.data.html } : {}),
    });
  } catch (error) {
    console.error("[inbound] relais support:", error);
  }
}
