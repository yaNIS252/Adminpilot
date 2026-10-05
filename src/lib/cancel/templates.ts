import type { Enums } from "@/lib/supabase/types";

/**
 * Bases légales de résiliation en droit français.
 *
 * Affichées sur la page de résiliation et les guides publics : elles doivent
 * être exactes. Une base légale erronée ferait manquer un délai, et
 * l'utilisateur l'apprendrait trop tard — souvent après reconduction.
 *
 * La base légale n'est jamais choisie à la volée : elle vient de
 * `known_providers.legal_basis`, donnée vérifiée à la main.
 */

export type LegalTemplate = {
  label: string;
  article: string;
  /** Contrainte de délai, à rappeler à l'utilisateur avant l'envoi. */
  timing: string;
};

export const LEGAL_TEMPLATES: Record<Enums<"legal_basis">, LegalTemplate> = {
  hamon: {
    label: "Loi Hamon",
    article: "article L. 113-15-2 du Code des assurances",
    timing:
      "Possible à tout moment après un an de contrat, sans frais ni pénalité. La résiliation prend effet un mois après réception.",
  },
  chatel: {
    label: "Loi Chatel",
    article: "article L. 215-1 du Code de la consommation",
    timing:
      "À l'échéance annuelle, avec préavis. Si l'avis d'échéance est reçu moins de quinze jours avant la date limite, le délai de résiliation est prolongé de vingt jours.",
  },
  infra_annuelle: {
    label: "Résiliation infra-annuelle",
    article: "article L. 932-12-1 du Code de la sécurité sociale",
    timing:
      "Possible à tout moment après un an d'adhésion, pour les complémentaires santé. Effet un mois après réception.",
  },
  libre: {
    label: "Contrat sans engagement",
    article: "conditions générales du contrat",
    timing:
      "Résiliable à tout moment, selon le préavis prévu aux conditions générales.",
  },
};
