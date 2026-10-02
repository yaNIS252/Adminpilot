import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { Mistral } from "@mistralai/mistralai";

/**
 * Fournisseurs d'IA.
 *
 * Mistral est le fournisseur principal : société française, hébergement dans
 * l'Union européenne, ce qui simplifie la conformité RGPD d'un produit qui
 * lit des factures et des contrats. Anthropic reste utilisable en secours :
 * il ne sert que si sa clé est configurée et pas celle de Mistral.
 */

export type AiProvider = "mistral" | "anthropic";

/** Fournisseur actif, d'après les clés présentes. */
export function aiProvider(): AiProvider | null {
  if (process.env.MISTRAL_API_KEY) return "mistral";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

/** Vrai si un fournisseur est configuré. */
export function isAiConfigured(): boolean {
  return aiProvider() !== null;
}

/**
 * Modèles par fournisseur : un rapide pour le volume, un plus capable rejoué
 * seulement quand la confiance du premier passage est basse (≈ 10 % des cas).
 * Alias « latest » chez Mistral : ils suivent la dernière version publiée.
 */
export const MODELS: Record<AiProvider, { fast: string; accurate: string }> = {
  mistral: { fast: "mistral-small-latest", accurate: "mistral-medium-latest" },
  anthropic: { fast: "claude-haiku-4-5", accurate: "claude-sonnet-5" },
};

/** Lecture de texte des PDF, en repli quand le modèle refuse le fichier brut. */
export const MISTRAL_OCR_MODEL = "mistral-ocr-latest";

let mistral: Mistral | null = null;
let anthropic: Anthropic | null = null;

export function getMistral(): Mistral {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY manquante");
  // Le pipeline est asynchrone : une requête lente n'immobilise personne.
  // Mieux vaut patienter que multiplier les tentatives.
  mistral ??= new Mistral({ apiKey, timeoutMs: 120_000 });
  return mistral;
}

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY manquante");
  }
  anthropic ??= new Anthropic({ maxRetries: 3, timeout: 120_000 });
  return anthropic;
}
