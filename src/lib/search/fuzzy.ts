import { normalizeText } from "@/lib/search/parse-query";

/**
 * Correspondance approximative pour la recherche dans les documents.
 *
 * L'index plein texte de Postgres ne trouve que des mots entiers bien
 * orthographiés : « mistr » ou « factrue » ne donnaient rien. Un utilisateur a
 * au plus quelques centaines de documents ; on les compare donc ici, mot à
 * mot, en acceptant :
 *  · un mot commencé (« mistr » → « mistral ») ;
 *  · une faute de frappe : lettre en trop, en moins, remplacée ou deux
 *    lettres inversées (une faute jusqu'à 7 lettres, deux au-delà).
 */

const IGNORED = new Set([
  "ma", "mon", "mes", "la", "le", "les", "de", "du", "des", "un", "une",
  "pour", "en", "sur", "au", "aux", "et", "ou",
]);

/** Mots d'un texte, sans accents ni majuscules. */
export function wordsOf(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

/** Mots de la recherche qui comptent. */
export function queryTerms(text: string): string[] {
  return [...new Set(wordsOf(text).filter((word) => word.length > 1 && !IGNORED.has(word)))];
}

/** Distance d'édition avec inversion de deux lettres, arrêtée au-delà de `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push(new Array<number>(b.length + 1).fill(0));
    rows[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, rows[i - 2][j - 2] + 1);
      }
      rows[i][j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
  }
  return rows[a.length][b.length];
}

/** Fautes tolérées selon la longueur du mot tapé. */
function tolerance(term: string): number {
  if (term.length <= 3) return 0;
  if (term.length <= 7) return 1;
  return 2;
}

/**
 * Note d'un mot de la recherche face à un mot du document : 3 exact,
 * 2 début de mot, 1 faute de frappe, 0 aucun rapport.
 */
function termScore(term: string, word: string): number {
  if (word === term) return 3;
  if (term.length >= 2 && word.startsWith(term)) return 2;
  const max = tolerance(term);
  if (max === 0) return 0;
  if (distance(term, word, max) <= max) return 1;
  // Mot commencé avec une faute : « mistrl » pour « mistral ».
  if (word.length > term.length && distance(term, word.slice(0, term.length), max) <= max) {
    return 1;
  }
  return 0;
}

/**
 * Note d'un document : chaque mot de la recherche doit y trouver un
 * correspondant, sinon 0. Plus la note est haute, plus la correspondance est
 * exacte.
 */
export function matchScore(terms: string[], words: string[]): number {
  if (terms.length === 0) return 1;
  let total = 0;
  for (const term of terms) {
    let best = 0;
    for (const word of words) {
      const score = termScore(term, word);
      if (score > best) best = score;
      if (best === 3) break;
    }
    if (best === 0) return 0;
    total += best;
  }
  return total;
}
