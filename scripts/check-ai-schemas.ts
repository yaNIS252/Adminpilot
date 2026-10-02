/**
 * Vérifie les schémas JSON envoyés au modèle (sortie structurée Mistral),
 * sans appel réseau. Développement uniquement.
 *
 * Usage : npm run check:ai-schemas
 */

import { jsonSchemaOf } from "../src/lib/ai/mistral";
import { DocumentExtractionSchema, EmailExtractionSchema, SearchFiltersSchema } from "../src/lib/ai/schemas";

for (const [name, schema] of Object.entries({
  extraction_email: EmailExtractionSchema,
  extraction_document: DocumentExtractionSchema,
  filtres_recherche: SearchFiltersSchema,
})) {
  const json = jsonSchemaOf(schema) as { type?: string; required?: string[]; properties?: Record<string, unknown> };
  const props = Object.keys(json.properties ?? {});
  const missing = props.filter((prop) => !(json.required ?? []).includes(prop));
  console.log(`${name}: type=${json.type}, ${props.length} champs, non requis=[${missing.join(", ")}], taille=${JSON.stringify(json).length} car.`);
}

// Une réponse type du modèle doit passer la validation zod.
const sample = {
  type: "cancellation", provider: "Netflix", amount: null, currency: "EUR",
  billing_cycle: "unknown", next_renewal: null, category: "streaming", confidence: 0.9,
  reasoning: "confirmation de résiliation", manage_url: null, previous_amount: null,
  effective_date: "2026-11-15",
};
console.log("réponse type valide :", EmailExtractionSchema.safeParse(sample).success);
