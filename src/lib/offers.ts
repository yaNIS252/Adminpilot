/**
 * Comparateur : offres moins chères que l'abonnement en cours.
 *
 * Classement par prix mensuel, et par rien d'autre — c'est ce que la page
 * annonce, et l'existence d'une commission ne doit jamais faire monter une
 * offre (obligation de transparence des plateformes, art. L111-7 du Code de
 * la consommation).
 */

/**
 * Catégories où un lien rémunéré exigerait un statut d'intermédiaire
 * (ORIAS pour l'assurance, IOBSP pour la banque) : on y affiche les offres
 * avec leur lien normal uniquement.
 */
export const NO_AFFILIATION_CATEGORIES = new Set(["assurance", "banque"]);

/** Comparateurs publics et gratuits, sans commission, par catégorie. */
export const PUBLIC_COMPARATORS: Record<string, { label: string; url: string }> = {
  energie: {
    label: "le comparateur officiel du Médiateur national de l’énergie",
    url: "https://www.energie-info.fr",
  },
};

export type OfferRow = {
  id: string;
  provider_name: string;
  name: string;
  monthly_price: number;
  conditions: string | null;
  url: string;
  affiliate_url: string | null;
  checked_at: string;
  category: string;
};

export type ComparedOffer = OfferRow & {
  yearlySaving: number;
  sponsored: boolean;
};

export function compareOffers(
  offers: OfferRow[],
  input: { currentMonthly: number; currentProvider: string },
): ComparedOffer[] {
  const current = input.currentProvider.toLowerCase();
  return offers
    .filter(
      (offer) =>
        Number(offer.monthly_price) < input.currentMonthly &&
        offer.provider_name.toLowerCase() !== current,
    )
    .map((offer) => ({
      ...offer,
      monthly_price: Number(offer.monthly_price),
      yearlySaving: Math.round((input.currentMonthly - Number(offer.monthly_price)) * 12 * 100) / 100,
      sponsored: Boolean(offer.affiliate_url) && !NO_AFFILIATION_CATEGORIES.has(offer.category),
    }))
    .sort((a, b) => a.monthly_price - b.monthly_price)
    .slice(0, 5);
}
