import type { Enums } from "@/lib/supabase/types";

/**
 * Limites par plan. Source de vérité unique : l'UI (plan-gate) et le serveur
 * (quotas) lisent la même table, donc un affichage ne peut pas diverger d'une
 * vérification réelle.
 *
 * `null` = illimité.
 */
export type Feature =
  | "subscriptions"
  | "documents"
  | "alerts"
  | "searches"
  | "cancellations";

export const PLAN_LIMITS: Record<
  Enums<"plan">,
  Record<Feature, number | null>
> = {
  // Scénario B du plan financier (septembre 2026) : un gratuit qui laisse
  // essayer le cœur du produit — détecter et être prévenu — et garde pour le
  // Pro ce qui fait gagner du temps ou de l'argent : recherche et résiliation.
  free: {
    subscriptions: 5,
    documents: 10,
    // Alertes ENVOYÉES dans le mois, automatiques comme manuelles.
    alerts: 3,
    searches: 0,
    cancellations: 0,
  },
  pro: {
    subscriptions: null,
    documents: null,
    alerts: null,
    searches: null,
    cancellations: null,
  },
  family: {
    subscriptions: null,
    documents: null,
    alerts: null,
    searches: null,
    cancellations: null,
  },
};

export const PLAN_PRICES = {
  pro: { monthly: 5.99, yearly: 49 },
  family: { monthly: 9.99, yearly: 89 },
} as const;

/** Nombre de comptes couverts par Premium, titulaire compris. */
export const FAMILY_SEATS = 5;

/**
 * Noms affichés des formules.
 *
 * L'identifiant interne `family` reste celui de la base et des prix Stripe ;
 * seul le nom change. « Famille » faisait hésiter les gens seuls ou en couple,
 * qui y voyaient une offre qui ne les concernait pas : Premium dit « le plus
 * complet », et le partage avec le foyer devient un avantage, pas une condition.
 */
export const PLAN_LABELS: Record<Enums<"plan">, string> = {
  free: "Gratuit",
  pro: "Pro",
  family: "Premium",
};

/**
 * Couleurs d'accent de l'interface. Les deux premières sont offertes ; les
 * autres font partie des petits plus des formules payantes. La liste doit
 * rester alignée sur la contrainte `profiles.accent` (migration 0011) et sur
 * les thèmes `[data-accent]` de globals.css.
 */
export const ACCENTS = [
  { id: "violet", label: "Violet", hex: "#8b7cf0", free: true },
  { id: "bleu", label: "Bleu", hex: "#5b9cf5", free: true },
  { id: "sarcelle", label: "Sarcelle", hex: "#3cbfc7", free: false },
  { id: "ambre", label: "Ambre", hex: "#f0964b", free: false },
  { id: "rose", label: "Rose", hex: "#e8729f", free: false },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

export function isAccentId(value: string): value is AccentId {
  return ACCENTS.some((accent) => accent.id === value);
}

/**
 * Fonds de l'interface, second volet du thème. Tous sombres : l'interface
 * repose sur des transparences blanches (bordures, cartes) qu'un fond clair
 * rendrait invisibles. Même règle que les couleurs : deux offerts, le reste
 * avec Pro. Alignés sur la contrainte `profiles.background` (migration 0012)
 * et sur les thèmes `[data-bg]` de globals.css.
 */
export const BACKGROUNDS = [
  { id: "nuit", label: "Nuit", hex: "#0a0a0f", free: true },
  { id: "charbon", label: "Charbon", hex: "#141414", free: true },
  { id: "ardoise", label: "Ardoise", hex: "#0c121a", free: false },
  { id: "foret", label: "Forêt", hex: "#0a120e", free: false },
  { id: "prune", label: "Prune", hex: "#130c16", free: false },
] as const;

export type BackgroundId = (typeof BACKGROUNDS)[number]["id"];

export function isBackgroundId(value: string): value is BackgroundId {
  return BACKGROUNDS.some((background) => background.id === value);
}

/**
 * Cookie de la bannière « Passer Pro » refermée. Défini ici et non dans le
 * composant client : une valeur exportée d'un fichier « use client » arrive
 * côté serveur sous forme de référence opaque, pas de chaîne.
 */
export const UPSELL_COOKIE = "ap_upsell_hidden";

/** Validité d'une invitation au foyer. */
export const INVITE_TTL_DAYS = 14;

// ---------------------------------------------------------------- parrainage

/** Cookie posé par le lien de parrainage, lu à l'inscription. */
export const REFERRAL_COOKIE = "ap_ref";
/** Carte « Et tes proches ? » du tableau de bord refermée. */
export const SHARE_COOKIE = "ap_share_hidden";
/**
 * Étape « messagerie » de la présentation de bienvenue, rouverte par le
 * bouton « Branche ta boîte mail ». Ici et non dans le composant client :
 * une valeur exportée d'un fichier « use client » n'est qu'une référence
 * opaque côté serveur.
 */
export const TOUR_MAILBOX_STEP = 2;
/** Bande de parrainage en haut de l'application refermée. */
export const REFERRAL_BANNER_COOKIE = "ap_referral_banner_hidden";

/**
 * Règles du parrainage. Ce sont celles que publient les CGU : les changer ici
 * impose de mettre l'article « Parrainage » à jour.
 */
export const REFERRAL = {
  /** Durée du Pro offert, au filleul comme au parrain. */
  bonusDays: 30,
  /** Plafond de mois offerts à un même parrain. */
  maxMonths: 12,
  /** Abonnements détectés depuis les e-mails du filleul pour valider. */
  minSubscriptions: 2,
  /** Ancienneté minimale du compte filleul pour valider (hors paiement). */
  minAgeDays: 7,
  /** Filleuls par adresse IP sur 30 jours au-delà desquels on écarte. */
  maxPerIp: 3,
  /** Conservation de l'empreinte d'IP. */
  ipRetentionDays: 30,
} as const;

// ---------------------------------------------------------------- ingestion

/** Types de fichiers acceptés à l'upload. Claude les lit tous nativement. */
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 Mo

/**
 * Rétention du document brut sur R2 après extraction.
 *
 * Obligation RGPD de minimisation : une fois les données structurées extraites,
 * l'email d'origine n'a plus d'utilité. On garde une fenêtre courte pour
 * pouvoir rejouer une extraction ratée, puis on purge.
 */
export const RAW_RETENTION_DAYS = 30;

// ---------------------------------------------------------------- alertes

/** Jours avant échéance déclenchant une alerte automatique. */
export const ALERT_OFFSETS_DAYS = [7, 1] as const;

// ---------------------------------------------------------------- résiliation

export const LEGAL_BASIS_LABELS: Record<Enums<"legal_basis">, string> = {
  hamon: "Loi Hamon — résiliation à tout moment après un an",
  chatel: "Loi Chatel — reconduction tacite et préavis",
  infra_annuelle: "Résiliation infra-annuelle — santé et mutuelle",
  libre: "Contrat sans engagement",
};
