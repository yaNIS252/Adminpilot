/**
 * Tests du moteur de recommandations (seuils 5 € ou 10 %, box/mobile).
 * Usage : npm run test:analysis
 */
import assert from "node:assert/strict";

import { recommend, type ReferenceOffer } from "../src/lib/offers/analysis";

const offer = (o: Partial<ReferenceOffer>): ReferenceOffer => ({
  id: o.id ?? "o",
  category: o.category ?? "telecom",
  kind: o.kind ?? null,
  provider_name: o.provider_name ?? "Concurrent",
  name: o.name ?? "Offre",
  monthly_price: o.monthly_price ?? 0,
  conditions: null,
  url: "https://exemple.fr",
  affiliate_url: null,
  checked_at: "2026-11-01",
  details: o.details ?? {},
});

const box = { id: "s1", provider: "Orange", amount: 45, cycle: "monthly", category: "telecom" };
const mobile = { id: "s2", provider: "Sosh", amount: 15, cycle: "monthly", category: "telecom" };
const offers = [
  offer({ id: "b", kind: "box", monthly_price: 38, provider_name: "Bbox" }),
  offer({ id: "m", kind: "mobile", monthly_price: 14.5, provider_name: "Free" }),
];

const recos = recommend([box, mobile], offers);
assert.equal(recos.length, 1, "box -7 € retenue, mobile -0,50 € (3 %) écartée");
assert.equal(recos[0].offer.id, "b");
assert.equal(Math.round(recos[0].yearlySaving), 84, "45 → 38 € = -84 €/an");

// 10 % suffit même sous 5 € : 12 € → 10,50 € (-12,5 %).
const small = recommend([{ ...mobile, amount: 12 }], [offer({ kind: "mobile", monthly_price: 10.5 })]);
assert.equal(small.length, 1);

// Catégorie hors analyse, ou aucune offre active : rien.
assert.equal(recommend([{ ...box, category: "streaming" }], offers).length, 0);
assert.equal(recommend([box], []).length, 0);

// Annuel ramené au mois : assurance 600 €/an = 50 €/mois.
const ins = recommend(
  [{ id: "a", provider: "MAIF", amount: 600, cycle: "yearly", category: "assurance" }],
  [offer({ category: "assurance", monthly_price: 42 })],
);
assert.equal(Math.round(ins[0].yearlySaving), 96);

// Énergie : remise de 10 % sur le kWh, appliquée à 80 % d'une facture de
// 100 €/mois → 92 €/mois, -96 €/an, signalé comme estimation.
const energy = recommend(
  [{ id: "e", provider: "EDF", amount: 100, cycle: "monthly", category: "energie" }],
  [offer({ category: "energie", provider_name: "TotalEnergies", details: { remise_kwh_pct: 10 } })],
);
assert.equal(Math.round(energy[0].yearlySaving), 96);
assert.equal(energy[0].estimated, true);
// Une offre d'énergie sans remise renseignée n'est jamais proposée.
assert.equal(recommend([{ id: "e", provider: "EDF", amount: 100, cycle: "monthly", category: "energie" }], [offer({ category: "energie", monthly_price: 50 })]).length, 0);

// Alternatives : la moins chère d'abord, puis deux autres fournisseurs au plus,
// jamais la propre marque de l'utilisateur.
const many = recommend(
  [{ id: "f", provider: "Free Mobile", amount: 19.99, cycle: "monthly", category: "telecom" }],
  [
    offer({ id: "1", kind: "mobile", monthly_price: 9.9, provider_name: "Réglo Mobile" }),
    offer({ id: "2", kind: "mobile", monthly_price: 8.99, provider_name: "Lyca Mobile" }),
    offer({ id: "3", kind: "mobile", monthly_price: 9.99, provider_name: "NRJ Mobile" }),
    offer({ id: "4", kind: "mobile", monthly_price: 9.99, provider_name: "Syma" }),
    offer({ id: "5", kind: "mobile", monthly_price: 5, provider_name: "Free" }),
  ],
);
assert.equal(many[0].offer.id, "2");
assert.deepEqual(many[0].alternatives.map((a) => a.offer.id), ["1", "3"]);

console.log("recommend : 10 cas OK");
