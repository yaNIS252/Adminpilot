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
  kind?: string | null;
  details?: unknown;
};

export type ComparedOffer = OfferRow & {
  yearlySaving: number;
  sponsored: boolean;
  /** Prix calculé à partir d'une remise sur le kWh : ordre de grandeur. */
  estimated: boolean;
};

export function compareOffers(
  offers: OfferRow[],
  input: { currentMonthly: number; currentProvider: string; kind?: "box" | "mobile" | null },
): ComparedOffer[] {
  const current = input.currentProvider.toLowerCase().replace(/[^a-z0-9]/g, "");
  return offers
    // Box et mobile ne se comparent pas entre eux.
    .filter((offer) => !input.kind || !offer.kind || offer.kind === input.kind)
    .map((offer) => {
      // Énergie : le prix dépend de la consommation. Seule une remise sur le
      // kWh, appliquée à la facture actuelle, donne un chiffre honnête.
      const discount = offer.category === "energie" ? kwhDiscount(offer.details) : null;
      if (offer.category === "energie" && discount === null) return null;
      const monthly =
        discount !== null
          ? Math.round(input.currentMonthly * (1 - (discount / 100) * KWH_SHARE) * 100) / 100
          : Number(offer.monthly_price);
      return { offer, monthly, estimated: discount !== null };
    })
    .filter((item): item is { offer: OfferRow; monthly: number; estimated: boolean } => item !== null)
    .filter(({ offer, monthly }) => {
      const name = offer.provider_name.toLowerCase().replace(/[^a-z0-9]/g, "");
      return monthly > 0 && monthly < input.currentMonthly && !current.startsWith(name) && !name.startsWith(current);
    })
    .map(({ offer, monthly, estimated }) => ({
      ...offer,
      monthly_price: monthly,
      estimated,
      yearlySaving: Math.round((input.currentMonthly - monthly) * 12 * 100) / 100,
      sponsored: Boolean(offer.affiliate_url) && !NO_AFFILIATION_CATEGORIES.has(offer.category),
    }))
    .sort((a, b) => a.monthly_price - b.monthly_price)
    .slice(0, 5);
}

/** Part de la facture d'électricité qui dépend du prix du kWh. */
export const KWH_SHARE = 0.8;

export function kwhDiscount(details: unknown): number | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const pct = (details as Record<string, unknown>).remise_kwh_pct;
  return typeof pct === "number" && pct > 0 && pct < 50 ? pct : null;
}
