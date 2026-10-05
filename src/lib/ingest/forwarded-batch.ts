import "server-only";

import PostalMime from "postal-mime";
import type { Resend } from "resend";

import { ingestDocumentBuffer, isDocumentPart } from "@/lib/ingest/attachments";
import { hashEmail } from "@/lib/ingest/dedupe";
import { enqueue } from "@/lib/ingest/pipeline";
import { isOwnMessage } from "@/lib/ingest/sender-learning";
import { isSecurityEmail } from "@/lib/ingest/sensitive";
import { buildKey, uploadRaw } from "@/lib/storage";
import type { Enums } from "@/lib/supabase/types";

/**
 * Import de l'historique : plusieurs e-mails transférés d'un coup, chacun
 * joint au message (Gmail : sélectionner → « Transférer en tant que pièce
 * jointe »).
 *
 * Gmail n'applique jamais un filtre aux e-mails déjà reçus ; c'est le moyen
 * de récupérer en une manipulation un an de factures, sans donner aucun
 * accès à la boîte. Chaque e-mail joint est traité comme s'il avait été
 * transféré seul : mêmes contrôles (sécurité, AdminPilot), même
 * dédoublonnage par Message-ID — réimporter deux fois ne crée rien.
 */

/**
 * Plafond par envoi : le traitement doit tenir dans la durée d'une fonction
 * (environ une seconde par e-mail). Au-delà, l'utilisateur fait plusieurs envois.
 */
const MAX_MESSAGES = 50;
const MAX_MESSAGE_BYTES = 15 * 1024 * 1024;

type Attachment = {
  id: string;
  filename: string | null;
  content_type: string;
};

export function isForwardedMessage(attachment: { filename: string | null; content_type: string }): boolean {
  return (
    attachment.content_type.toLowerCase().startsWith("message/rfc822") ||
    /\.eml$/i.test(attachment.filename ?? "")
  );
}

export async function ingestForwardedMessages(input: {
  resend: Resend;
  emailId: string;
  userId: string;
  plan: Enums<"plan">;
  attachments: Attachment[];
}): Promise<{ messages: number; documents: number }> {
  const parts = input.attachments.filter(isForwardedMessage).slice(0, MAX_MESSAGES);
  let messages = 0;
  let documents = 0;

  for (const part of parts) {
    try {
      const { data, error } = await input.resend.emails.receiving.attachments.get({
        emailId: input.emailId,
        id: part.id,
      });
      if (error || !data || data.size > MAX_MESSAGE_BYTES) continue;
      const response = await fetch(data.download_url);
      if (!response.ok) continue;

      const email = await PostalMime.parse(await response.arrayBuffer());
      const from = email.from && "address" in email.from && email.from.address
        ? email.from.name
          ? `${email.from.name} <${email.from.address}>`
          : email.from.address
        : "";
      const subject = email.subject ?? "";
      const body = email.text || email.html || "";
      if (!from || !body) continue;
      if (isOwnMessage({ from, subject, body }) || isSecurityEmail(subject)) continue;

      const contentHash = hashEmail({
        messageId: email.messageId ?? null,
        from,
        subject,
        body,
      });
      const key = buildKey({ userId: input.userId, source: "email", contentHash, extension: "json" });
      await uploadRaw({
        key,
        body: JSON.stringify({ from, subject, date: email.date ?? new Date().toISOString(), body }),
        contentType: "application/json",
      });
      const result = await enqueue({
        userId: input.userId,
        source: "email",
        contentHash,
        rawUrl: key,
        mimeType: "message/rfc822",
      });
      if (result.status === "duplicate") continue;
      messages += 1;

      // Factures PDF jointes à cet e-mail : rangées comme documents.
      for (const attachment of email.attachments) {
        const candidate = {
          filename: attachment.filename,
          content_type: attachment.mimeType,
          content_disposition: attachment.disposition,
          content_id: attachment.contentId ?? null,
        };
        if (!isDocumentPart(candidate) || typeof attachment.content === "string") continue;
        const added = await ingestDocumentBuffer({
          userId: input.userId,
          plan: input.plan,
          buffer: Buffer.from(attachment.content as ArrayBuffer),
          filename: attachment.filename ?? "piece-jointe.pdf",
        });
        if (added) documents += 1;
      }
    } catch (error) {
      console.error("[inbound] e-mail joint:", error);
    }
  }
  return { messages, documents };
}
