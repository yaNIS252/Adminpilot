import { z } from "zod";

/**
 * Source de vérité unique des données extraites par l'IA.
 *
 * Ces schémas servent trois usages à partir d'une seule définition :
 *  1. contrat des structured outputs Claude (via `toJsonSchema`)
 *  2. validation avant insertion en base
 *  3. types TypeScript dans l'UI
 *
 * Toute modification ici se propage partout — c'est voulu.
 */

export const BILLING_CYCLES = [
  "monthly",
  "yearly",
  "quarterly",
  "weekly",
  "one_time",
  "unknown",
] as const;

export const DOC_CATEGORIES = [
  "facture",
  "contrat",
  "assurance",
  "impots",
  "banque",
  "logement",
  "sante",
  "vehicule",
  "identite",
  "travail",
  "autre",
] as const;

export const SUB_CATEGORIES = [
  "streaming",
  "energie",
  "telecom",
  "assurance",
  "banque",
  "transport",
  "logement",
  "sante",
  "logiciel",
  "presse",
  "sport",
  "autre",
] as const;

/** Date ISO `YYYY-MM-DD`, ou null quand le document ne la donne pas. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "attendu YYYY-MM-DD")
  .nullable();

/**
 * Niveau de certitude du modèle. Pilote l'escalade vers Sonnet et la file de
 * revue manuelle. Affiché à l'utilisateur : on ne masque jamais une incertitude.
 */
const confidence = z.number().min(0).max(1);

// ------------------------------------------------------------------ email

export const EmailExtractionSchema = z.object({
  /** `skip` couvre tout ce qui n'est pas transactionnel (newsletters, pubs...). */
  /**
   * `price_change` : annonce d'un changement de tarif à venir. `amount` porte
   * alors le NOUVEAU prix et `previous_amount` l'ancien, s'il est cité.
   */
  type: z.enum([
    "subscription",
    "invoice",
    "contract",
    "receipt",
    "price_change",
    /** Confirmation qu'un abonnement est résilié ; `effective_date` = fin d'accès. */
    "cancellation",
    "skip",
  ]),
  provider: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().default("EUR"),
  billing_cycle: z.enum(BILLING_CYCLES).default("unknown"),
  next_renewal: isoDate,
  /**
   * Date de la facture ou du paiement (celle du message d'origine pour un
   * e-mail transféré). Sert à déduire l'échéance suivante quand l'e-mail ne
   * la donne pas.
   */
  invoice_date: isoDate.default(null),
  category: z.enum(SUB_CATEGORIES).default("autre"),
  confidence,
  /** Ce sur quoi le modèle s'est appuyé — sert au débogage des faux positifs. */
  reasoning: z.string().max(300).nullable(),
  /**
   * Lien « gérer / résilier mon abonnement » présent dans l'e-mail. Recopié
   * tel quel, jamais construit ; le pipeline ne le garde que s'il mène au
   * domaine du fournisseur (voir `trustedLink`).
   */
  manage_url: z.string().max(500).nullable().default(null),
  /** Ancien prix, quand l'e-mail l'indique (annonce de hausse surtout). */
  previous_amount: z.number().nullable().default(null),
  /** Date d'application d'un nouveau tarif annoncé. */
  effective_date: isoDate.default(null),
});

export type EmailExtraction = z.infer<typeof EmailExtractionSchema>;

// ------------------------------------------------------------------ document

export const DocumentExtractionSchema = z.object({
  category: z.enum(DOC_CATEGORIES),
  /** Nom de fichier lisible, ex. `Facture_EDF_2026-09.pdf`. */
  suggested_name: z.string().max(120),
  provider: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().default("EUR"),
  document_date: isoDate,
  /** Échéance de paiement ou d'action détectée dans le document. */
  deadline: isoDate,
  /**
   * Périodicité facturée, quand le document l'indique (« abonnement
   * mensuel », période du 1er au 30). Sert à compléter l'abonnement suivi.
   */
  billing_cycle: z.enum(BILLING_CYCLES).default("unknown"),
  reference: z.string().nullable(),
  confidence,
});

export type DocumentExtraction = z.infer<typeof DocumentExtractionSchema>;

// ------------------------------------------------------------------ recherche

export const SearchFiltersSchema = z.object({
  category: z.enum(DOC_CATEGORIES).nullable(),
  provider: z.string().nullable(),
  date_from: isoDate,
  date_to: isoDate,
  amount_min: z.number().nullable(),
  amount_max: z.number().nullable(),
  /** Termes restants, passés à la recherche full-text. */
  keywords: z.string().nullable(),
});

export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

// ------------------------------------------------------------------ seuils

/** En dessous : on rejoue sur un modèle plus capable. */
export const ESCALATION_THRESHOLD = 0.7;

/** En dessous : la ligne part en file de revue manuelle, jamais affichée comme acquise. */
export const REVIEW_THRESHOLD = 0.4;
