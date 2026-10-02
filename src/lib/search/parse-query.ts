import type { SearchFilters } from "@/lib/ai/schemas";

/**
 * Lecture d'une recherche en français courant, sans modèle.
 *
 * Couvre ce que les gens tapent vraiment — « facture edf mars », « mes
 * fiches de paie 2025 », « assurance plus de 50 € » — sans latence, sans coût
 * et sans clé d'API. Le modèle n'intervient qu'en complément, quand il est
 * configuré, pour les formulations plus libres.
 */

/** Minuscules sans accents, pour comparer sans se soucier de la saisie. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Expressions → catégorie. Les plus longues d'abord : « contrat de travail » avant « contrat ». */
const CATEGORY_WORDS: [string, SearchFilters["category"]][] = [
  ["contrat de travail", "travail"],
  ["fiche de paie", "travail"],
  ["fiches de paie", "travail"],
  ["bulletin de paie", "travail"],
  ["bulletins de paie", "travail"],
  ["avis d'imposition", "impots"],
  ["taxe fonciere", "impots"],
  ["taxe d'habitation", "impots"],
  ["carte grise", "vehicule"],
  ["controle technique", "vehicule"],
  ["carte d'identite", "identite"],
  ["releve de compte", "banque"],
  ["releves de compte", "banque"],
  ["quittance", "logement"],
  ["quittances", "logement"],
  ["loyer", "logement"],
  ["bail", "logement"],
  ["factures", "facture"],
  ["facture", "facture"],
  ["contrats", "contrat"],
  ["contrat", "contrat"],
  ["assurances", "assurance"],
  ["assurance", "assurance"],
  ["impots", "impots"],
  ["impot", "impots"],
  ["releve", "banque"],
  ["releves", "banque"],
  ["rib", "banque"],
  ["banque", "banque"],
  ["mutuelle", "sante"],
  ["ordonnance", "sante"],
  ["sante", "sante"],
  ["voiture", "vehicule"],
  ["vehicule", "vehicule"],
  ["passeport", "identite"],
  ["identite", "identite"],
  ["permis", "identite"],
  ["salaire", "travail"],
];

const MONTHS = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
];

const STOPWORDS = new Set([
  "ma", "mon", "mes", "la", "le", "les", "de", "du", "des", "d", "l", "un", "une",
  "trouve", "trouver", "cherche", "chercher", "montre", "retrouve", "retrouver",
  "pour", "en", "sur", "a", "au", "aux", "et", "ou", "euros", "euro", "eur",
  "document", "documents", "fichier", "fichiers", "ce", "cette", "dernier", "derniere",
]);

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseSearchQuery(query: string, today = new Date()): SearchFilters {
  let text = ` ${normalizeText(query).replace(/[’]/g, "'")} `;
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;

  const filters: SearchFilters = {
    category: null,
    provider: null,
    date_from: null,
    date_to: null,
    amount_min: null,
    amount_max: null,
    keywords: null,
  };

  const take = (pattern: RegExp): RegExpExecArray | null => {
    const match = pattern.exec(text);
    if (match) text = text.replace(match[0], " ");
    return match;
  };

  // Montants, avant les années : « plus de 2000 € » n'est pas une date.
  const between = take(/\bentre\s+(\d+(?:[.,]\d+)?)\s*(?:€|euros?)?\s+et\s+(\d+(?:[.,]\d+)?)\s*(?:€|euros?)?/);
  if (between) {
    filters.amount_min = Number(between[1].replace(",", "."));
    filters.amount_max = Number(between[2].replace(",", "."));
  }
  const above = take(/(?:\bplus de|\bsuperieure? a|\bau-dessus de|>)\s*(\d+(?:[.,]\d+)?)\s*(?:€|euros?)?/);
  if (above) filters.amount_min = Number(above[1].replace(",", "."));
  const below = take(/(?:\bmoins de|\binferieure? a|\ben dessous de|<)\s*(\d+(?:[.,]\d+)?)\s*(?:€|euros?)?/);
  if (below) filters.amount_max = Number(below[1].replace(",", "."));

  for (const [words, category] of CATEGORY_WORDS) {
    const pattern = new RegExp(`(^|[\\s'])${words.replace(/'/g, "'")}(?=[\\s.,;!?]|$)`);
    if (pattern.test(text)) {
      filters.category = category;
      text = text.replace(pattern, "$1 ");
      break;
    }
  }

  // Périodes relatives.
  if (take(/\bl'an(?:nee)? derniere?\b/)) {
    filters.date_from = iso(year - 1, 1, 1);
    filters.date_to = iso(year - 1, 12, 31);
  } else if (take(/\bcette annee\b/)) {
    filters.date_from = iso(year, 1, 1);
    filters.date_to = iso(year, month, today.getUTCDate());
  } else if (take(/\bmois dernier\b/)) {
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    filters.date_from = iso(y, m, 1);
    filters.date_to = iso(y, m, lastDay(y, m));
  } else {
    const monthMatch = take(new RegExp(`\\b(${MONTHS.join("|")})\\b(?:\\s+(20\\d{2}))?`));
    const yearMatch = monthMatch?.[2] ? null : take(/\b(20\d{2})\b/);
    if (monthMatch) {
      const m = MONTHS.indexOf(monthMatch[1]) + 1;
      // Sans année : le mois le plus récemment écoulé, jamais celui à venir.
      const y = monthMatch[2] ? Number(monthMatch[2]) : m > month ? year - 1 : year;
      filters.date_from = iso(y, m, 1);
      filters.date_to = iso(y, m, lastDay(y, m));
    } else if (yearMatch) {
      const y = Number(yearMatch[1]);
      filters.date_from = iso(y, 1, 1);
      filters.date_to = iso(y, 12, 31);
    }
  }

  const keywords = text
    .split(/[\s'.,;:!?()€"]+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
  filters.keywords = keywords.length ? keywords.join(" ") : null;

  return filters;
}
