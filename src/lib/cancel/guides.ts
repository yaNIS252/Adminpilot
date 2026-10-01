import type { Json } from "@/lib/supabase/types";

/**
 * Guides de résiliation : parcours par fournisseur et astuces par catégorie.
 *
 * Les parcours viennent de `known_providers.cancel_guide` (migration 0014).
 * Les astuces, elles, reposent sur des mécanismes légaux stables plutôt que
 * sur les menus d'un site : elles restent justes quand l'interface change.
 */

export type CancelGuide = {
  steps: string[];
  note: string | null;
  /** Date à laquelle le parcours a été refait à la main ; null = indicatif. */
  checkedAt: string | null;
};

/** Lit le JSON du catalogue ; ignore toute forme inattendue. */
export function parseGuide(value: Json | null | undefined): CancelGuide | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const steps = Array.isArray(value.steps)
    ? value.steps.filter((step): step is string => typeof step === "string" && step.length > 0)
    : [];
  if (steps.length === 0) return null;
  return {
    steps,
    note: typeof value.note === "string" ? value.note : null,
    checkedAt: typeof value.checked_at === "string" ? value.checked_at : null,
  };
}

export const CATEGORY_TIPS: Record<string, { title: string; body: string }> = {
  telecom: {
    title: "Tu changes d'opérateur ?",
    body: "Ne résilie pas toi-même : appelle le 3179 (gratuit) depuis ta ligne pour obtenir ton code RIO et donne-le au nouvel opérateur. Il résilie l'ancien contrat pour toi et tu gardes ton numéro, sans coupure.",
  },
  energie: {
    title: "Tu changes de fournisseur ?",
    body: "Le nouveau fournisseur résilie l'ancien contrat à ta place, sans frais ni coupure. Résilier toi-même n'est utile qu'en cas de déménagement : indique alors la date de départ et ton relevé de compteur.",
  },
  assurance: {
    title: "Tu as trouvé moins cher ailleurs ?",
    body: "Pour une assurance auto, moto ou habitation de plus d'un an, ton nouvel assureur peut résilier l'ancien contrat pour toi (loi Hamon). Tu n'as rien à envoyer.",
  },
  banque: {
    title: "Tu changes de banque ?",
    body: "Avec la mobilité bancaire, la nouvelle banque transfère tes prélèvements et virements et peut clôturer l'ancien compte pour toi, gratuitement. Demande-le à l'ouverture du compte.",
  },
  streaming: {
    title: "Payé via ton téléphone ?",
    body: "Si l'abonnement a été pris dans une application et payé par l'App Store ou Google Play, la résiliation se fait dans les réglages du téléphone, pas sur le site du service.",
  },
  logiciel: {
    title: "Payé via ton téléphone ?",
    body: "Si l'abonnement a été pris dans une application et payé par l'App Store ou Google Play, la résiliation se fait dans les réglages du téléphone, pas sur le site du service.",
  },
};
