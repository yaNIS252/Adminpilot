import { monthlyEquivalent } from "@/lib/format";

/**
 * Analyse : dépenses par catégorie et changements de fournisseur rentables.
 *
 * Une recommandation n'apparaît que si une offre ACTIVE (donc vérifiée par
 * nous, avec sa source et sa date) de la même catégorie coûte au moins 5 €
 * par mois ou 10 % de moins. Aucun prix n'est estimé ni inventé.
 */

export const ANALYSED_CATEGORIES = ["energie", "telecom", "assurance"] as const;

const MIN_MONTHLY_SAVING = 5;
const MIN_SAVING_RATIO = 0.1;

/** Marques qui ne vendent que du mobile. */
const MOBILE_BRANDS = /\b(free mobile|sosh|red by sfr|b&you|prixtel|la poste mobile|youprice|syma|lebara|lyca)\b/i;

export type AnalysedSubscription = {
  id: string;
  provider: string;
  amount: number | null;
  cycle: string;
  category: string | null;
};

export type ReferenceOffer = {
  id: string;
  category: string;
  kind: string | null;
  provider_name: string;
  name: string;
  monthly_price: number;
  conditions: string | null;
  url: string;
  affiliate_url: string | null;
  checked_at: string;
};

export type Recommendation = {
  subscription: AnalysedSubscription;
  currentMonthly: number;
  offer: ReferenceOffer;
  monthlySaving: number;
  yearlySaving: number;
};

/**
 * Box ou mobile, pour un abonnement télécom. Le nom suffit pour les marques
 * 100 % mobile ; sinon le prix tranche (une box coûte rarement moins de
 * 20 € par mois, un forfait mobile rarement plus). Heuristique assumée.
 */
export function telecomKind(sub: AnalysedSubscription, monthly: number): "box" | "mobile" {
  if (MOBILE_BRANDS.test(sub.provider) || /mobile|forfait/i.test(sub.provider)) return "mobile";
  return monthly >= 20 ? "box" : "mobile";
}

export function recommend(subs: AnalysedSubscription[], offers: ReferenceOffer[]): Recommendation[] {
  const results: Recommendation[] = [];
  for (const sub of subs) {
    if (!sub.category || !(ANALYSED_CATEGORIES as readonly string[]).includes(sub.category)) continue;
    const currentMonthly = monthlyEquivalent(sub.amount, sub.cycle);
    if (currentMonthly <= 0) continue;
    const kind = sub.category === "telecom" ? telecomKind(sub, currentMonthly) : null;

    const best = offers
      .filter((offer) => offer.category === sub.category && (kind === null || offer.kind === kind))
      // Pas de « changer pour le même » : on compare à d'autres fournisseurs.
      .filter((offer) => offer.provider_name.toLowerCase() !== sub.provider.toLowerCase())
      .sort((a, b) => a.monthly_price - b.monthly_price)[0];
    if (!best) continue;

    const monthlySaving = currentMonthly - best.monthly_price;
    if (monthlySaving < MIN_MONTHLY_SAVING && monthlySaving < currentMonthly * MIN_SAVING_RATIO) continue;
    if (monthlySaving <= 0) continue;

    results.push({
      subscription: sub,
      currentMonthly,
      offer: best,
      monthlySaving,
      yearlySaving: monthlySaving * 12,
    });
  }
  return results.sort((a, b) => b.yearlySaving - a.yearlySaving);
}
