/**
 * Tests de `getNextRenewal` : avance des échéances passées, fins de mois.
 * Usage : npm run test:renewal
 */
import assert from "node:assert/strict";

import { getNextRenewal } from "../src/lib/ingest/schedule";

const now = new Date("2026-11-11T10:00:00Z");
const cases: [string | null, string, string | null, string][] = [
  ["2026-12-01", "monthly", "2026-12-01", "date à venir inchangée"],
  ["2026-11-11", "monthly", "2026-11-11", "aujourd'hui compte comme à venir"],
  ["2026-10-17", "monthly", "2026-11-17", "mensuel passé : +1 mois"],
  ["2026-08-17", "monthly", "2026-11-17", "plusieurs mois de retard"],
  ["2026-10-01", "quarterly", "2027-01-01", "trimestriel"],
  ["2025-06-30", "yearly", "2027-06-30", "annuel passé : +1 an jusqu'au futur"],
  ["2026-11-04", "weekly", "2026-11-11", "hebdomadaire"],
  ["2026-01-31", "monthly", "2026-11-30", "31 → fin de mois plus courte (pas de dérive au-delà)"],
  ["2026-10-01", "one_time", null, "paiement unique passé : pas de compteur"],
  ["2026-10-01", "unknown", null, "périodicité inconnue passée : pas de compteur"],
  ["2026-12-24", "unknown", "2026-12-24", "inconnue mais à venir : gardée"],
  [null, "monthly", null, "sans date"],
];

for (const [date, cycle, expected, label] of cases) {
  assert.equal(getNextRenewal(date, cycle, now), expected, label);
}

// 31 janvier + 1 mois = 28 février (année non bissextile), 29 en bissextile.
assert.equal(getNextRenewal("2027-01-31", "monthly", new Date("2027-02-15T00:00:00Z")), "2027-02-28");
assert.equal(getNextRenewal("2028-01-31", "monthly", new Date("2028-02-15T00:00:00Z")), "2028-02-29");

console.log(`getNextRenewal : ${cases.length + 2} cas OK`);
