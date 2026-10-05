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

/**
 * Une clé plausible, pas un texte de remplissage. Une valeur provisoire
 * (« aa », « xxx ») faisait croire l'IA configurée : chaque e-mail reçu
 * échouait alors à l'analyse jusqu'à être abandonné, au lieu d'attendre la
 * vraie clé en file.
 */
function usableKey(value: string | undefined): boolean {
  return Boolean(value && value.trim().length >= 20 && !/\s/.test(value.trim()));
}

/** Fournisseur actif, d'après les clés présentes. */
export function aiProvider(): AiProvider | null {
  if (usableKey(process.env.MISTRAL_API_KEY)) return "mistral";
  if (usableKey(process.env.ANTHROPIC_API_KEY)) return "anthropic";
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
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey || !usableKey(apiKey)) throw new Error("MISTRAL_API_KEY manquante ou invalide");
  // Le pipeline est asynchrone : une requête lente n'immobilise personne.
  // Mieux vaut patienter que multiplier les tentatives.
  //
  // Limite de débit (429) : réessai automatique avec attente croissante. Un
  // import d'historique envoie des dizaines d'e-mails d'un coup, et plusieurs
  // passages de la file peuvent se chevaucher ; sans ce réessai, les appels
  // refusés partaient en échec et attendaient la tâche du lendemain.
  mistral ??= new Mistral({
    apiKey,
    timeoutMs: 120_000,
    retryConfig: {
      strategy: "backoff",
      backoff: { initialInterval: 1_000, maxInterval: 10_000, exponent: 2, maxElapsedTime: 45_000 },
      retryConnectionErrors: true,
    },
  });
  return mistral;
}

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY manquante");
  }
  anthropic ??= new Anthropic({ maxRetries: 3, timeout: 120_000 });
  return anthropic;
}
