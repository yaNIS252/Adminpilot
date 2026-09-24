/**
 * Harnais d'évaluation de l'extraction.
 *
 * C'est le garde-fou du produit. Sans lui, toute retouche de prompt est un
 * pari : on ne saurait dire si elle améliore la précision ou la dégrade, et la
 * dégradation ne se verrait qu'à travers les plaintes d'utilisateurs.
 *
 * Usage : npm run eval:extract
 * Jeu de test : fixtures/emails/*.json, annotés à la main.
 *
 * Seuils d'acceptation (cf. docs/PLAN.md) :
 *   provider     > 90%
 *   amount       > 90%
 *   next_renewal > 80%   — le champ le plus dur, souvent absent du mail
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { extractFromEmail } from "../src/lib/ai/extract";
import type { EmailExtraction } from "../src/lib/ai/schemas";

type Fixture = {
  name: string;
  input: { from: string; subject: string; date: string; body: string };
  expected: Partial<EmailExtraction>;
};

const FIXTURES_DIR = join(process.cwd(), "fixtures", "emails");
const FIELDS = [
  "type",
  "provider",
  "amount",
  "billing_cycle",
  "next_renewal",
] as const;

const THRESHOLDS: Partial<Record<(typeof FIELDS)[number], number>> = {
  provider: 0.9,
  amount: 0.9,
  next_renewal: 0.8,
};

/**
 * Comparaison tolérante aux écarts sans importance : un fournisseur reste juste
 * qu'il soit écrit "EDF" ou "edf", et un montant à un centime près relève de
 * l'arrondi, pas de l'erreur d'extraction.
 */
function matches(field: string, actual: unknown, expected: unknown): boolean {
  if (expected === undefined) return true;
  if (actual === null || expected === null) return actual === expected;

  if (field === "provider") {
    return (
      String(actual).toLowerCase().trim() ===
      String(expected).toLowerCase().trim()
    );
  }
  if (field === "amount") {
    return Math.abs(Number(actual) - Number(expected)) < 0.01;
  }
  return actual === expected;
}

async function loadFixtures(): Promise<Fixture[]> {
  const files = (await readdir(FIXTURES_DIR)).filter((f) =>
    f.endsWith(".json"),
  );
  return Promise.all(
    files.map(async (file) => ({
      ...(JSON.parse(await readFile(join(FIXTURES_DIR, file), "utf8")) as
        Omit<Fixture, "name">),
      name: file.replace(/\.json$/, ""),
    })),
  );
}

async function main() {
  const fixtures = await loadFixtures();
  if (!fixtures.length) {
    console.error(`Aucune fixture dans ${FIXTURES_DIR}`);
    process.exit(1);
  }

  const scores = new Map<string, { hits: number; total: number }>();
  for (const field of FIELDS) scores.set(field, { hits: 0, total: 0 });

  const failures: string[] = [];
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let escalations = 0;

  for (const fixture of fixtures) {
    const result = await extractFromEmail(fixture.input);
    totalTokensIn += result.tokensIn;
    totalTokensOut += result.tokensOut;
    if (result.escalated) escalations += 1;

    for (const field of FIELDS) {
      const expected = fixture.expected[field];
      if (expected === undefined) continue;

      const score = scores.get(field)!;
      score.total += 1;

      const actual = result.data[field];
      if (matches(field, actual, expected)) {
        score.hits += 1;
      } else {
        failures.push(
          `${fixture.name} · ${field} : attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`,
        );
      }
    }
  }

  console.log(`\n${fixtures.length} fixtures · ${escalations} escalades\n`);

  let passed = true;
  for (const field of FIELDS) {
    const { hits, total } = scores.get(field)!;
    if (total === 0) continue;

    const rate = hits / total;
    const threshold = THRESHOLDS[field];
    const ok = threshold === undefined || rate >= threshold;
    if (!ok) passed = false;

    const target = threshold ? ` (seuil ${(threshold * 100).toFixed(0)}%)` : "";
    console.log(
      `${ok ? "✓" : "✗"} ${field.padEnd(14)} ${(rate * 100).toFixed(1)}%  ${hits}/${total}${target}`,
    );
  }

  if (failures.length) {
    console.log("\nÉcarts :");
    for (const failure of failures) console.log(`  · ${failure}`);
  }

  // Tarif Haiku 4.5 : 1$ / 5$ par million de tokens.
  const cost = (totalTokensIn / 1e6) * 1 + (totalTokensOut / 1e6) * 5;
  console.log(`\nCoût de cette passe : ${cost.toFixed(4)} $`);

  process.exit(passed ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
