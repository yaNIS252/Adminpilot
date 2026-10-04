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
 * Objets typiques d'un e-mail de facturation. Limité à l'objet : dans le
 * corps, « abonnement » apparaît aussi au pied de chaque newsletter.
 */
export const KEYWORD_QUERY =
  'subject:(facture OR prélèvement OR échéance OR renouvellement OR "votre abonnement" OR "votre reçu" OR "nouveau tarif")';

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
export const EXCLUDED_QUERY =
  'subject:(code OR "mot de passe" OR "nouvel appareil" OR "nouvelle connexion" OR "tentative de connexion" OR "vérification" OR "verification" OR "sécurité" OR "security" OR "password" OR "sign-in" OR "login" OR OTP OR "authentification") OR AdminPilot';

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
