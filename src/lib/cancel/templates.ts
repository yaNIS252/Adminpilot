import type { Enums } from "@/lib/supabase/types";

/**
 * Bases légales de résiliation en droit français.
 *
 * Ces textes sont cités dans les lettres générées : ils doivent être exacts.
 * Une lettre invoquant le mauvais article donne au fournisseur un motif de
 * refus, et l'utilisateur l'apprend trop tard — souvent après reconduction.
 *
 * La base légale n'est jamais choisie à la volée : elle vient de
 * `known_providers.legal_basis`, donnée vérifiée à la main, et le texte de la
 * lettre est assemblé par `buildLetter`.
 */

export type LegalTemplate = {
  label: string;
  article: string;
  /** Contrainte de délai, à rappeler à l'utilisateur avant l'envoi. */
  timing: string;
  /** Formulation de référence, reprise telle quelle dans la lettre. */
  clause: string;
};

export const LEGAL_TEMPLATES: Record<Enums<"legal_basis">, LegalTemplate> = {
  hamon: {
    label: "Loi Hamon",
    article: "article L. 113-15-2 du Code des assurances",
    timing:
      "Possible à tout moment après un an de contrat, sans frais ni pénalité. La résiliation prend effet un mois après réception.",
    clause:
      "Conformément à l'article L. 113-15-2 du Code des assurances, je vous demande de résilier mon contrat, celui-ci ayant dépassé sa première année d'engagement.",
  },
  chatel: {
    label: "Loi Chatel",
    article: "article L. 215-1 du Code de la consommation",
    timing:
      "À l'échéance annuelle, avec préavis. Si l'avis d'échéance est reçu moins de quinze jours avant la date limite, le délai de résiliation est prolongé de vingt jours.",
    clause:
      "Conformément à l'article L. 215-1 du Code de la consommation, je vous informe de mon refus de reconduction tacite et vous demande de résilier mon contrat à son échéance.",
  },
  infra_annuelle: {
    label: "Résiliation infra-annuelle",
    article: "article L. 932-12-1 du Code de la sécurité sociale",
    timing:
      "Possible à tout moment après un an d'adhésion, pour les complémentaires santé. Effet un mois après réception.",
    clause:
      "Conformément au droit de résiliation infra-annuelle, je vous demande de résilier mon adhésion, celle-ci ayant dépassé sa première année.",
  },
  libre: {
    label: "Contrat sans engagement",
    article: "conditions générales du contrat",
    timing:
      "Résiliable à tout moment, selon le préavis prévu aux conditions générales.",
    clause:
      "Mon contrat étant sans engagement, je vous demande de procéder à sa résiliation selon les modalités prévues aux conditions générales.",
  },
};
