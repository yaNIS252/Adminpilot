/**
 * Informations légales de l'éditeur — LE fichier à compléter avant
 * d'accepter de vrais clients.
 *
 * Tant qu'un champ vaut `null`, les pages légales affichent un encadré
 * « À compléter » à sa place, et /api/health le signale. Rien ici ne doit
 * être deviné : un SIREN ou un médiateur inventé est pire qu'un champ vide.
 */
export const LEGAL = {
  /** Nom commercial du service. */
  tradeName: "AdminPilot",
  /** « Prénom Nom », entrepreneur individuel (EI). */
  editorName: null as string | null,
  /** 9 chiffres, sur l'avis de situation INSEE. */
  siren: null as string | null,
  /** Adresse de domiciliation de l'entreprise (une adresse personnelle est possible). */
  address: null as string | null,
  /** Adresse de contact affichée publiquement. */
  contactEmail: null as string | null,
  /** Téléphone (exigé par la LCEN pour joindre l'éditeur rapidement). */
  phone: null as string | null,
  /** En général l'entrepreneur lui-même. */
  publicationDirector: null as string | null,
  /** Adresse pour les demandes RGPD (peut être la même que le contact). */
  privacyEmail: null as string | null,
  /**
   * Médiateur de la consommation : adhésion obligatoire avant de vendre à des
   * particuliers (art. L612-1 du Code de la consommation).
   */
  mediator: {
    name: null as string | null,
    website: null as string | null,
    address: null as string | null,
  },
  /** Franchise en base de TVA tant que le seuil n'est pas dépassé. */
  vatMention: "TVA non applicable, art. 293 B du CGI.",
};

/** Champs encore manquants, en clair, pour l'encadré et le bilan de santé. */
export function missingLegalFields(): string[] {
  const missing: string[] = [];
  if (!LEGAL.editorName) missing.push("nom de l’entrepreneur");
  if (!LEGAL.siren) missing.push("numéro SIREN");
  if (!LEGAL.address) missing.push("adresse");
  if (!LEGAL.contactEmail) missing.push("e-mail de contact");
  if (!LEGAL.phone) missing.push("téléphone");
  if (!LEGAL.publicationDirector) missing.push("directeur de la publication");
  if (!LEGAL.privacyEmail) missing.push("contact données personnelles");
  if (!LEGAL.mediator.name || !LEGAL.mediator.website) missing.push("médiateur de la consommation");
  return missing;
}
