/**
 * Interception du code de confirmation de transfert Gmail.
 *
 * Quand un utilisateur configure un transfert automatique, Gmail envoie un code
 * de validation à l'adresse de destination — donc chez nous. On le détecte au
 * vol, on l'affiche en direct dans l'app et on propose le lien de confirmation
 * en un clic.
 *
 * C'est ce qui remplace l'OAuth Gmail au MVP, et c'est le point de rupture
 * numéro un du produit : si l'utilisateur échoue ici, il n'a jamais rien vu.
 */

export type GmailConfirmation = {
  code: string;
  /** Lien de confirmation, quand Gmail l'inclut. */
  url: string | null;
};

const GMAIL_SENDERS = [
  "forwarding-noreply@google.com",
  "noreply@google.com",
] as const;

// Gmail formate le code en blocs de chiffres, longueur variable selon la locale.
const CODE_PATTERN = /\b(\d{6,12})\b/;
const URL_PATTERN =
  /https:\/\/mail\.google\.com\/mail\/[^\s"'<>)]*(?:vf-|ForwardingVerification)[^\s"'<>)]*/i;

/**
 * Renvoie le code si l'email est bien une demande de validation Gmail, sinon
 * `null`. On exige l'expéditeur ET un marqueur textuel : un simple code à six
 * chiffres dans un email quelconque ne doit pas déclencher de faux positif.
 */
export function detectGmailConfirmation(input: {
  from: string;
  subject: string;
  body: string;
}): GmailConfirmation | null {
  const from = input.from.toLowerCase();
  if (!GMAIL_SENDERS.some((sender) => from.includes(sender))) return null;

  const haystack = `${input.subject}\n${input.body}`;

  const looksLikeForwarding =
    /(confirmation|vérification|verification|transfert|forwarding)/i.test(
      haystack,
    );
  if (!looksLikeForwarding) return null;

  const code = CODE_PATTERN.exec(haystack)?.[1];
  if (!code) return null;

  return { code, url: URL_PATTERN.exec(haystack)?.[0] ?? null };
}

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/**
 * Adresse qui demande le transfert, telle que Gmail la cite dans sa demande
 * de validation (« jean@gmail.com a demandé à transférer… »). On écarte notre
 * propre domaine et les adresses de Google ; la première qui reste est la
 * boîte de l'utilisateur.
 */
export function forwardingSourceAddress(body: string, inboundDomain: string): string | null {
  for (const match of body.matchAll(EMAIL_PATTERN)) {
    const address = match[0].toLowerCase();
    const domain = address.split("@")[1] ?? "";
    if (domain === inboundDomain || domain.endsWith(`.${inboundDomain}`)) continue;
    if (domain === "google.com" || domain.endsWith(".google.com")) continue;
    return address;
  }
  return null;
}
