/**
 * Filtres Gmail prêts à importer.
 *
 * Gmail accepte un fichier de filtres (Paramètres → Filtres et adresses
 * bloquées → Importer des filtres). On en génère un par utilisateur : il
 * transfère vers son adresse AdminPilot les e-mails des fournisseurs connus,
 * et en option ceux dont l'objet parle de facture ou de prélèvement. Deux
 * minutes une fois, puis chaque nouvelle facture arrive seule — sans nous
 * donner aucun accès à la boîte.
 *
 * Le transfert ne vaut que pour les e-mails reçus après la création du
 * filtre ; les anciens se transfèrent à la main.
 */

/** Domaines par filtre : un critère trop long est refusé par Gmail. */
const DOMAINS_PER_FILTER = 25;

/**
 * Objet d'un e-mail de facturation chez un fournisseur connu. Exigé en plus
 * de l'expéditeur : sans lui, le filtre transférait aussi toutes les
 * publicités d'Apple, d'Amazon ou de Disney+ (une trentaine sur cinquante
 * e-mails lors de l'examen blanc), lues par l'IA puis jetées.
 */
export const BILLING_SUBJECT =
  'subject:(facture OR reçu OR "votre reçu" OR receipt OR invoice OR abonnement OR subscription OR prélèvement OR échéance OR renouvellement OR paiement OR payment OR tarif OR "essai gratuit" OR "free trial" OR résiliation OR bienvenue OR welcome)';

/**
 * Objet d'une facture chez un expéditeur inconnu (option « mots-clés ») :
 * plus strict encore, car rien ne garantit que l'expéditeur soit une
 * entreprise. « Prélèvement » seul attrapait par exemple des courriers
 * administratifs sans rapport.
 */
export const KEYWORD_QUERY =
  'subject:(facture OR "votre reçu" OR "reçu de paiement" OR "votre abonnement" OR renouvellement OR invoice OR receipt)';

/**
 * Jamais transférés, quel que soit le filtre : codes de connexion, alertes de
 * sécurité, réinitialisations de mot de passe. Ils n'apportent rien au suivi
 * des abonnements et donneraient à un tiers de quoi entrer dans un compte.
 * Une seconde barrière existe à la réception (`isSecurityEmail`).
 *
 * Ni rien qui parle d'AdminPilot : nos rappels et le reçu de l'abonnement
 * AdminPilot, déjà suivi depuis Stripe, reviendraient sinon en doublon — ou
 * en boucle (`isOwnMessage` les arrête aussi à la réception).
 */
export const EXCLUDED_SUBJECT =
  'subject:(code OR "mot de passe" OR "nouvel appareil" OR "nouvelle connexion" OR "tentative de connexion" OR "vérification" OR "verification" OR "sécurité" OR "security" OR "password" OR "sign-in" OR "login" OR OTP OR "authentification" OR "clé d\'accès" OR passkey OR "récupération de compte" OR "commande")';

export const EXCLUDED_QUERY = `${EXCLUDED_SUBJECT} OR AdminPilot`;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Critère « De » d'un groupe de domaines, aussi utilisable à la main. */
export function fromCriteria(domains: string[]): string {
  return domains.join(" OR ");
}

export function chunkDomains(domains: string[]): string[][] {
  // Un domaine, ou une adresse exacte pour les messageries grand public.
  const unique = [...new Set(domains.map((domain) => domain.toLowerCase().trim()))]
    .filter((domain) => /^([a-z0-9._%+-]+@)?[a-z0-9.-]+\.[a-z]{2,}$/.test(domain))
    .sort();
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += DOMAINS_PER_FILTER) {
    chunks.push(unique.slice(index, index + DOMAINS_PER_FILTER));
  }
  return chunks;
}

function entry(properties: Record<string, string>): string {
  const props = Object.entries(properties)
    .map(([name, value]) => `    <apps:property name='${name}' value='${escapeXml(value)}'/>`)
    .join("\n");
  return `  <entry>
    <category term='filter'></category>
    <title>Mail Filter</title>
    <content></content>
${props}
  </entry>`;
}

export function buildGmailFilterXml(input: {
  forwardTo: string;
  domains: string[];
  includeKeywords: boolean;
}): string {
  const entries = chunkDomains(input.domains).map((group) =>
    entry({
      from: fromCriteria(group),
      hasTheWord: BILLING_SUBJECT,
      doesNotHaveTheWord: EXCLUDED_QUERY,
      forwardTo: input.forwardTo,
    }),
  );
  if (input.includeKeywords) {
    entries.push(
      entry({
        hasTheWord: KEYWORD_QUERY,
        doesNotHaveTheWord: EXCLUDED_QUERY,
        forwardTo: input.forwardTo,
      }),
    );
  }

  return `<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns='http://www.w3.org/2005/Atom' xmlns:apps='http://schemas.google.com/apps/2006'>
  <title>Filtres AdminPilot</title>
${entries.join("\n")}
</feed>
`;
}

/**
 * Recherche Gmail des factures déjà reçues, à coller dans la barre de
 * recherche avant un « Transférer en tant que pièce jointe » groupé : les
 * fournisseurs connus et les objets de facturation des douze derniers mois,
 * sans codes de sécurité ni e-mails d'AdminPilot. L'utilisateur voit la
 * liste et décoche ce qu'il ne veut pas envoyer avant de transférer.
 */
export function historySearchQuery(domains: string[]): string {
  const senders = chunkDomains(domains).flat();
  const known = senders.length ? `(from:(${fromCriteria(senders)}) ${BILLING_SUBJECT}) OR ` : "";
  // Onglet Promotions exclu : les publicités y sont rangées par Gmail.
  return `(${known}${KEYWORD_QUERY}) -${EXCLUDED_SUBJECT} -AdminPilot -category:promotions -category:social newer_than:1y`;
}
