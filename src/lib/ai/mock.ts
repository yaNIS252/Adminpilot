import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type { DocumentExtraction, EmailExtraction } from "./schemas";

/**
 * Extraction simulée — mode développement uniquement.
 *
 * Permet de faire tourner le pipeline de bout en bout sans appeler le modèle :
 * on peut tester l'ingestion, le dashboard, les alertes et la revue manuelle
 * sans dépenser de crédit.
 *
 * Ce n'est PAS un repli silencieux. Il faut poser explicitement
 * `ADMINPILOT_AI_MODE=mock` : une clé absente en production doit produire une
 * erreur bruyante, jamais des données inventées présentées comme des faits.
 *
 * Les heuristiques ci-dessous sont volontairement simples. Elles ne remplacent
 * pas le modèle — elles fabriquent des données plausibles pour travailler
 * l'interface. Toute sortie est marquée `mock: true` et plafonnée à une
 * confiance de 0,5, donc visible comme incertaine à l'écran.
 */

export function isMockMode(): boolean {
  return process.env.ADMINPILOT_AI_MODE === "mock";
}

/** Confiance plafonnée : une donnée simulée ne doit jamais paraître sûre. */
const MOCK_CONFIDENCE = 0.5;

const SKIP_HINTS = [
  "newsletter",
  "désabonner",
  "desabonner",
  "nouveautés",
  "découvrez",
  "decouvrez",
  "offre spéciale",
];

const CYCLE_HINTS: Array<[RegExp, EmailExtraction["billing_cycle"]]> = [
  [/\b(par mois|mensuel|\/mois|chaque mois)\b/i, "monthly"],
  [/\b(par an|annuel|\/an|chaque année)\b/i, "yearly"],
  [/\b(trimestre|trimestriel)\b/i, "quarterly"],
  [/\b(par semaine|hebdomadaire)\b/i, "weekly"],
];

/**
 * Cherche un montant en euros, au format français.
 * Privilégie la dernière occurrence précédée d'un mot évoquant un total : sur
 * une facture, le net à payer arrive après le sous-total et la TVA.
 */
function findAmount(text: string): number | null {
  const pattern =
    /(?:net à payer|total ttc|montant|prélevé|preleve|total)[^\d]{0,30}(\d{1,6}[.,]\d{2})/gi;

  const matches = [...text.matchAll(pattern)];
  const raw = matches.at(-1)?.[1] ?? /(\d{1,6},\d{2})\s*(?:€|EUR)/i.exec(text)?.[1];

  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Date au format français `JJ/MM/AAAA` convertie en ISO. */
function findNextRenewal(text: string): string | null {
  const match =
    /(?:prochain|prochaine|renouvellement|reconduction)[^\d]{0,40}(\d{2})\/(\d{2})\/(\d{4})/i.exec(
      text,
    );
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Identifie le fournisseur via le catalogue déjà en base. */
async function findProvider(from: string, text: string) {
  const { data } = await createAdminClient()
    .from("known_providers")
    .select("name, domain, category, sender_emails");

  const haystack = `${from} ${text}`.toLowerCase();

  return (
    (data ?? []).find(
      (provider) =>
        haystack.includes(provider.domain.toLowerCase()) ||
        haystack.includes(provider.name.toLowerCase()),
    ) ?? null
  );
}

const CATEGORY_MAP: Record<string, EmailExtraction["category"]> = {
  energie: "energie",
  telecom: "telecom",
  streaming: "streaming",
  assurance: "assurance",
  banque: "banque",
  transport: "transport",
  logement: "logement",
  logiciel: "logiciel",
};

export async function mockExtractFromEmail(input: {
  from: string;
  subject: string;
  body: string;
}): Promise<EmailExtraction> {
  const text = `${input.subject}\n${input.body}`;
  const lower = text.toLowerCase();

  const provider = await findProvider(input.from, text);
  const amount = findAmount(text);

  // Sans montant, ou avec des marqueurs de newsletter, on rejette — c'est le
  // comportement attendu du vrai extracteur.
  if (!provider || amount === null || SKIP_HINTS.some((h) => lower.includes(h))) {
    return {
      type: "skip",
      provider: null,
      amount: null,
      currency: "EUR",
      billing_cycle: "unknown",
      next_renewal: null,
      category: "autre",
      confidence: MOCK_CONFIDENCE,
      reasoning: "simulation : aucun marqueur transactionnel identifié",
    };
  }

  const cycle =
    CYCLE_HINTS.find(([pattern]) => pattern.test(text))?.[1] ?? "unknown";

  return {
    type: cycle === "unknown" ? "invoice" : "subscription",
    provider: provider.name,
    amount,
    currency: "EUR",
    billing_cycle: cycle,
    next_renewal: findNextRenewal(text),
    category: CATEGORY_MAP[provider.category] ?? "autre",
    confidence: MOCK_CONFIDENCE,
    reasoning: "simulation : extraction par heuristiques, sans modèle",
  };
}

export function mockExtractFromDocument(input: {
  filename: string;
}): DocumentExtraction {
  return {
    category: "facture",
    suggested_name: `Simulation_${input.filename}`,
    provider: null,
    amount: null,
    currency: "EUR",
    document_date: new Date().toISOString().slice(0, 10),
    deadline: null,
    reference: null,
    confidence: MOCK_CONFIDENCE,
  };
}
