import { monthlyEquivalent } from "@/lib/format";
import { KWH_SHARE, kwhDiscount } from "@/lib/offers";

/**
 * Analyse : dépenses par catégorie et changements de fournisseur rentables.
 *
 * Une recommandation n'apparaît que si une offre ACTIVE (donc vérifiée par
 * nous, avec sa source et sa date) de la même catégorie coûte au moins 5 €
 * par mois ou 10 % de moins. Aucun prix n'est inventé.
 *
 * Énergie : une facture dépend de la consommation, un prix mensuel d'offre
 * ne veut donc rien dire. L'offre porte la remise sur le prix du kWh par
 * rapport au tarif réglementé (`details.remise_kwh_pct`), appliquée à la part
 * consommation de la facture actuelle (environ 80 %, l'abonnement étant
 * aligné sur le tarif réglementé). Le résultat est signalé comme estimation.
 */

export const ANALYSED_CATEGORIES = ["energie", "telecom", "assurance"] as const;

const MIN_MONTHLY_SAVING = 5;
/** Offres moins chères montrées en plus de la meilleure. */
const MAX_ALTERNATIVES = 2;
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
  details?: unknown;
};

export type PricedOffer = {
  offer: ReferenceOffer;
  /** Prix mensuel de l'offre pour cet utilisateur. */
  monthly: number;
  monthlySaving: number;
  yearlySaving: number;
  /** Calculé à partir d'une remise sur le kWh : ordre de grandeur. */
  estimated: boolean;
};

export type Recommendation = {
  subscription: AnalysedSubscription;
  currentMonthly: number;
  offer: ReferenceOffer;
  monthlySaving: number;
  yearlySaving: number;
  estimated: boolean;
  /** Autres offres moins chères, d'autres fournisseurs. */
  alternatives: PricedOffer[];
};

function priceFor(offer: ReferenceOffer, currentMonthly: number): PricedOffer | null {
  const discount = offer.category === "energie" ? kwhDiscount(offer.details) : null;
  if (offer.category === "energie" && discount === null) return null;
  const monthly =
    discount !== null ? currentMonthly * (1 - (discount / 100) * KWH_SHARE) : offer.monthly_price;
  if (monthly <= 0) return null;
  const monthlySaving = currentMonthly - monthly;
  return { offer, monthly, monthlySaving, yearlySaving: monthlySaving * 12, estimated: discount !== null };
}

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

    const priced = offers
      .filter((offer) => offer.category === sub.category && (kind === null || offer.kind === kind))
      // Pas de « changer pour le même » : on compare à d'autres fournisseurs.
      .filter((offer) => !sameProvider(offer.provider_name, sub.provider))
      .map((offer) => priceFor(offer, currentMonthly))
      .filter((item): item is PricedOffer => item !== null)
      .filter(
        (item) =>
          item.monthlySaving > 0 &&
          (item.monthlySaving >= MIN_MONTHLY_SAVING || item.monthlySaving >= currentMonthly * MIN_SAVING_RATIO),
      )
      .sort((a, b) => a.monthly - b.monthly);
    if (priced.length === 0) continue;

    // Une seule offre par fournisseur dans les alternatives.
    const [best, ...rest] = priced;
    const seen = new Set([best.offer.provider_name.toLowerCase()]);
    const alternatives = rest
      .filter((item) => {
        const key = item.offer.provider_name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_ALTERNATIVES);

    results.push({
      subscription: sub,
      currentMonthly,
      offer: best.offer,
      monthlySaving: best.monthlySaving,
      yearlySaving: best.yearlySaving,
      estimated: best.estimated,
      alternatives,
    });
  }
  return results.sort((a, b) => b.yearlySaving - a.yearlySaving);
}

/**
 * Même fournisseur, ou même marque (« Free » et « Free Mobile ») : on ne
 * propose pas de « changer » pour sa propre marque.
 */
function sameProvider(offerProvider: string, subProvider: string): boolean {
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const a = norm(offerProvider);
  const b = norm(subProvider);
  return a === b || b.startsWith(a) || a.startsWith(b);
}
