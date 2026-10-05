import "server-only";

import type { Resend } from "resend";

import { checkLimit } from "@/lib/billing/quotas";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { hashFile } from "@/lib/ingest/dedupe";
import { enqueue } from "@/lib/ingest/pipeline";
import { sniffMimeType } from "@/lib/ingest/sniff";
import { buildKey, uploadRaw } from "@/lib/storage";
import type { Enums } from "@/lib/supabase/types";

/**
 * Pièces jointes d'un e-mail transféré : la facture PDF d'EDF, d'IONOS…
 *
 * Chacune devient un document, exactement comme un dépôt manuel : rangé,
 * renommé, consultable. Sans ça, l'abonnement était détecté depuis le texte
 * de l'e-mail mais la facture elle-même n'arrivait jamais dans Documents.
 *
 * Seuls les PDF et les images réellement jointes sont gardés : les logos et
 * signatures insérés dans le corps (pièces « inline ») ne sont pas des
 * documents. La limite de documents de la formule s'applique comme à l'upload.
 */

const MAX_ATTACHMENTS = 5;

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type Attachment = {
  id: string;
  filename: string | null;
  content_type: string;
  content_disposition: string | null;
  content_id: string | null;
};

function isDocumentAttachment(attachment: Omit<Attachment, "id">): boolean {
  const type = attachment.content_type.toLowerCase().split(";")[0]?.trim() ?? "";
  if (type === "application/pdf" || type === "application/octet-stream") {
    // Certains logiciels de facturation envoient leurs PDF en type générique.
    return type === "application/pdf" || /\.pdf$/i.test(attachment.filename ?? "");
  }
  if (!(type in EXTENSIONS)) return false;
  // Image : seulement une vraie pièce jointe, pas un logo inséré dans le corps.
  return attachment.content_disposition?.toLowerCase() === "attachment" && !attachment.content_id;
}

/**
 * Range un fichier reçu (pièce jointe) comme document, exactement comme un
 * dépôt manuel. Vrai si un nouveau document a été mis en file.
 */
export async function ingestDocumentBuffer(input: {
  userId: string;
  plan: Enums<"plan">;
  buffer: Buffer;
  filename: string;
}): Promise<boolean> {
  if (input.buffer.length > MAX_UPLOAD_BYTES) return false;
  const quota = await checkLimit(input.userId, input.plan, "documents");
  if (!quota.allowed) return false;

  // Le type annoncé vient de l'expéditeur : seul le contenu réel compte.
  const actualType = sniffMimeType(input.buffer);
  if (!actualType || !(actualType in EXTENSIONS)) return false;

  const contentHash = hashFile(input.buffer);
  const key = buildKey({
    userId: input.userId,
    source: "upload",
    contentHash,
    extension: EXTENSIONS[actualType] ?? "bin",
  });
  await uploadRaw({ key, body: input.buffer, contentType: actualType });

  const result = await enqueue({
    userId: input.userId,
    source: "upload",
    contentHash,
    rawUrl: key,
    mimeType: actualType,
    originalFilename: input.filename,
  });
  return result.status !== "duplicate";
}

/** Vrai pour une pièce jointe qui ressemble à un document à ranger. */
export function isDocumentPart(part: {
  filename: string | null;
  content_type: string;
  content_disposition: string | null;
  content_id: string | null;
}): boolean {
  return isDocumentAttachment(part);
}

/** Nombre de documents mis en file. Ne lève pas : l'e-mail reste traité. */
export async function ingestAttachments(input: {
  resend: Resend;
  emailId: string;
  userId: string;
  plan: Enums<"plan">;
  attachments: Attachment[];
}): Promise<number> {
  const candidates = input.attachments.filter(isDocumentAttachment).slice(0, MAX_ATTACHMENTS);
  let queued = 0;

  for (const attachment of candidates) {
    try {
      const { data, error } = await input.resend.emails.receiving.attachments.get({
        emailId: input.emailId,
        id: attachment.id,
      });
      if (error || !data || data.size > MAX_UPLOAD_BYTES) continue;

      const response = await fetch(data.download_url);
      if (!response.ok) continue;
      const added = await ingestDocumentBuffer({
        userId: input.userId,
        plan: input.plan,
        buffer: Buffer.from(await response.arrayBuffer()),
        filename: attachment.filename ?? data.filename ?? "piece-jointe",
      });
      if (added) queued += 1;
    } catch (error) {
      console.error("[inbound] pièce jointe:", error);
    }
  }
  return queued;
}
