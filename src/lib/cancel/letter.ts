import type { Enums } from "@/lib/supabase/types";

import { LEGAL_TEMPLATES } from "./templates";

/**
 * Texte de la lettre de résiliation.
 *
 * Gabarit fixe et non rédaction par le modèle. Une lettre de résiliation est
 * un exercice formel dont la seule partie délicate — la base légale — était
 * déjà imposée au modèle mot pour mot : il ne restait à écrire que des
 * formules convenues. Un gabarit produit la même lettre sans latence, sans
 * coût, sans clé d'API, et surtout sans risque qu'un détail soit inventé dans
 * un document que l'utilisateur envoie à son nom.
 */
export function buildLetter(input: {
  provider: string;
  basis: Enums<"legal_basis">;
  reference: string | null;
}): { subject: string; body: string } {
  const template = LEGAL_TEMPLATES[input.basis];
  const reference = input.reference?.trim() || null;

  const subject = reference
    ? `Résiliation du contrat n° ${reference}`
    : `Résiliation de mon contrat ${input.provider}`;

  const opening = reference
    ? `Titulaire du contrat n° ${reference} souscrit auprès de ${input.provider}, je vous notifie par la présente ma décision d’y mettre fin.`
    : `Titulaire d’un contrat souscrit auprès de ${input.provider} au nom et à l’adresse indiqués ci-dessus, je vous notifie par la présente ma décision d’y mettre fin.`;

  const body = [
    "Madame, Monsieur,",
    opening,
    template.clause,
    "Je vous remercie de bien vouloir procéder à cette résiliation dans les délais applicables, de cesser tout prélèvement à compter de sa prise d’effet, et de m’adresser une confirmation écrite précisant sa date d’effet.",
    "Je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.",
  ].join("\n\n");

  return { subject, body };
}
