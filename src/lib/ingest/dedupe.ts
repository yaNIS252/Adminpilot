import { createHash } from "node:crypto";

/**
 * Empreinte d'un email.
 *
 * Le `Message-ID` est l'identifiant canonique d'un email : stable même si
 * l'utilisateur transfère deux fois le même message. On ne se rabat sur le
 * contenu que lorsqu'il est absent, ce qui arrive avec certains transferts
 * automatiques qui réécrivent les en-têtes.
 */
export function hashEmail(input: {
  messageId?: string | null;
  from: string;
  subject: string;
  body: string;
}): string {
  const basis = input.messageId?.trim()
    ? `mid:${input.messageId.trim()}`
    : `content:${input.from}|${input.subject}|${input.body.slice(0, 4000)}`;

  return createHash("sha256").update(basis, "utf8").digest("hex");
}

/**
 * Empreinte d'un fichier : le contenu binaire intégral.
 * Deux uploads du même PDF, même renommé, donnent le même hash.
 */
export function hashFile(buffer: Buffer | Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}
