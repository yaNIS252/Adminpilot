/**
 * Offres groupées : un abonnement qui en contient d'autres (box avec
 * plateformes de streaming, Canal+ avec Netflix, banque avec abonnements
 * partenaires).
 *
 * Utilisées par le simulateur de l'Analyse : si l'utilisateur paie à part un
 * service compris dans une offre groupée, on lui montre ce qu'il paierait en
 * la prenant à la place. Chaque entrée a sa source et sa date de relevé ; un
 * prix qui n'a pas été vérifié n'a rien à faire ici. À revérifier avec le
 * reste du catalogue d'offres.
 */

export type BundleService = {
  /** Nom affiché (« Netflix »). */
  label: string;
  /** Reconnaît un abonnement de l'utilisateur couvert par ce service. */
  match: RegExp;
  /** Ne couvre qu'une box internet (catégorie télécom, hors mobile). */
  box?: boolean;
};

export type Bundle = {
  id: string;
  provider: string;
  name: string;
  /** Prix mensuel actuel (promotion comprise). */
  monthly: number;
  /** Prix après la promotion, s'il change. */
  later?: { monthly: number; afterMonths: number };
  includes: BundleService[];
  conditions: string | null;
  url: string;
  checkedAt: string;
};

const NETFLIX: BundleService = { label: "Netflix", match: /netflix/i };
const DISNEY: BundleService = { label: "Disney+", match: /disney/i };
const PRIME: BundleService = { label: "Prime Video", match: /prime video|amazon prime/i };
const CANAL: BundleService = { label: "Canal+", match: /canal\s?\+|canal plus|mycanal/i };
const HBO: BundleService = { label: "HBO Max", match: /hbo|^max$/i };
const APPLE_TV: BundleService = { label: "Apple TV", match: /apple tv/i };
const PARAMOUNT: BundleService = { label: "Paramount+", match: /paramount/i };
const OCS: BundleService = { label: "Ciné+ OCS", match: /\bocs\b|cin[ée]\+/i };

export const BUNDLES: Bundle[] = [
  {
    id: "freebox-ultra",
    provider: "Free",
    name: "Freebox Ultra",
    monthly: 49.99,
    later: { monthly: 59.99, afterMonths: 12 },
    includes: [
      { label: "Box internet", match: /./, box: true },
      NETFLIX,
      DISNEY,
      PRIME,
    ],
    conditions: "Sans engagement · Netflix, Disney+ et Prime Video en formule avec publicité",
    url: "https://www.free.fr/freebox/freebox-ultra/",
    checkedAt: "2026-11-16",
  },
  {
    id: "canal-cine-series",
    provider: "Canal+",
    name: "Canal+ Ciné Séries",
    monthly: 24.99,
    later: { monthly: 34.99, afterMonths: 12 },
    includes: [CANAL, NETFLIX, HBO, APPLE_TV, PARAMOUNT, OCS],
    conditions: "Engagement possible selon la formule",
    url: "https://www.canalplus.com/",
    checkedAt: "2026-11-16",
  },
  {
    id: "canal-moins-26",
    provider: "Canal+",
    name: "Canal+ moins de 26 ans",
    monthly: 19.99,
    includes: [CANAL, NETFLIX, HBO, APPLE_TV, PARAMOUNT, OCS],
    conditions: "Réservé aux moins de 26 ans, justificatif d’identité demandé",
    url: "https://www.canalplus.com/",
    checkedAt: "2026-11-16",
  },
  {
    id: "revolut-metal",
    provider: "Revolut",
    name: "Revolut Metal",
    monthly: 18.99,
    includes: [
      { label: "Super Duolingo", match: /duolingo/i },
      { label: "Flo Premium", match: /\bflo\b/i },
      { label: "L’Équipe", match: /l['’ ]?[ée]quipe/i },
      { label: "Lovable", match: /lovable/i },
    ],
    conditions: "Compte bancaire avec carte métal et assurances · liste des partenaires à vérifier dans l’appli Revolut",
    url: "https://www.revolut.com/fr-FR/our-pricing-plans/",
    checkedAt: "2026-11-16",
  },
];
