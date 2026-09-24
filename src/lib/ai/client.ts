import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Modèle par défaut du pipeline : classification et extraction en volume.
 * Haiku 4.5 — 200K de contexte, 1$/5$ par million de tokens.
 */
export const MODEL_FAST = "claude-haiku-4-5";

/**
 * Modèle d'escalade, rejoué quand la confiance du premier passage est basse.
 * Concerne ~10% du volume : le surcoût est marginal, le gain de précision ne
 * l'est pas sur les documents mal structurés.
 */
export const MODEL_ACCURATE = "claude-sonnet-5";

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY manquante");
  }
  cached ??= new Anthropic({
    // Le pipeline est asynchrone : une requête lente n'immobilise aucun
    // utilisateur. Mieux vaut patienter que multiplier les tentatives.
    maxRetries: 3,
    timeout: 120_000,
  });
  return cached;
}

/** Vrai si la clé est configurée. Permet de dégrader proprement en dev. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
