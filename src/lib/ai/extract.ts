import "server-only";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  CLASSIFY_DOCUMENT_SYSTEM,
  DOCUMENT_USER_PROMPT,
} from "@/prompts/classify-document";
import {
  CLASSIFY_EMAIL_SYSTEM,
  buildEmailUserMessage,
} from "@/prompts/classify-email";

import { MODELS, aiProvider, getAnthropic, type AiProvider } from "./client";
import { mistralJson, mistralOcrText } from "./mistral";
import { isMockMode, mockExtractFromDocument, mockExtractFromEmail } from "./mock";
import {
  DocumentExtractionSchema,
  ESCALATION_THRESHOLD,
  EmailExtractionSchema,
  type DocumentExtraction,
  type EmailExtraction,
} from "./schemas";

/** Ce que le pipeline consigne dans `ingestion_jobs` après chaque extraction. */
export type ExtractionResult<T> = {
  data: T;
  model: string;
  tokensIn: number;
  tokensOut: number;
  /** Vrai si le modèle rapide a été jugé insuffisant et rejoué sur le plus capable. */
  escalated: boolean;
};

/** Fournisseur actif ; une absence de clé doit échouer bruyamment. */
function requireProvider(): AiProvider {
  const provider = aiProvider();
  if (!provider) throw new Error("Aucune clé d'IA configurée (MISTRAL_API_KEY)");
  return provider;
}

/**
 * Deux passages au maximum : le modèle rapide d'abord, le plus capable
 * seulement si la confiance est sous le seuil. On garde le meilleur des deux résultats, jamais le dernier
 * par défaut — il arrive que l'escalade soit elle aussi peu sûre.
 */
async function withEscalation<T extends { confidence: number }>(
  provider: AiProvider,
  run: (model: string) => Promise<ExtractionResult<T>>,
  accurateOnly = false,
): Promise<ExtractionResult<T>> {
  if (accurateOnly) return { ...(await run(MODELS[provider].accurate)), escalated: true };
  const first = await run(MODELS[provider].fast);
  if (first.data.confidence >= ESCALATION_THRESHOLD) return first;

  const second = await run(MODELS[provider].accurate);
  const best = second.data.confidence > first.data.confidence ? second : first;

  return {
    ...best,
    // Le coût cumulé des deux passages, pas celui du seul gagnant.
    tokensIn: first.tokensIn + second.tokensIn,
    tokensOut: first.tokensOut + second.tokensOut,
    escalated: true,
  };
}

// ------------------------------------------------------------------ email

export async function extractFromEmail(
  input: {
    from: string;
    subject: string;
    date: string;
    body: string;
  },
  /** Directement le modèle le plus capable (seconde lecture). */
  options: { accurate?: boolean } = {},
): Promise<ExtractionResult<EmailExtraction>> {
  // Mode simulation : explicite, jamais un repli automatique sur clé absente.
  // Une clé manquante en production doit échouer bruyamment plutôt que de
  // produire des données inventées que l'utilisateur prendrait pour des faits.
  if (isMockMode()) {
    return {
      data: await mockExtractFromEmail(input),
      model: "mock",
      tokensIn: 0,
      tokensOut: 0,
      escalated: false,
    };
  }

  const provider = requireProvider();
  const userMessage = buildEmailUserMessage(input);

  if (provider === "mistral") {
    return withEscalation(provider, async (model) => {
      const result = await mistralJson({
        model,
        schema: EmailExtractionSchema,
        schemaName: "extraction_email",
        system: CLASSIFY_EMAIL_SYSTEM,
        content: userMessage,
      });
      return { ...result, model, escalated: false };
    }, options.accurate);
  }

  const client = getAnthropic();
  return withEscalation(provider, async (model) => {
    const response = await client.messages.parse({
      model,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: CLASSIFY_EMAIL_SYSTEM,
          // Préfixe stable entre tous les appels et tous les utilisateurs :
          // c'est lui qui rend le cache rentable.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
      output_config: { format: zodOutputFormat(EmailExtractionSchema) },
    });

    const data = response.parsed_output;
    if (!data) throw new Error(`Extraction email illisible (${model})`);

    return {
      data,
      model,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      escalated: false,
    };
  }, options.accurate);
}

// ------------------------------------------------------------------ document

const PDF = "application/pdf";
const IMAGES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export function isSupportedDocument(mimeType: string): boolean {
  return mimeType === PDF || (IMAGES as readonly string[]).includes(mimeType);
}

/**
 * Le fichier part tel quel vers le modèle — aucun OCR en amont.
 * PDF : bloc `document`. Image : bloc `image`. Le type de bloc doit
 * correspondre au type MIME réel, sans quoi l'API refuse la requête.
 */
export async function extractFromDocument(input: {
  base64: string;
  mimeType: string;
  filename: string;
}): Promise<ExtractionResult<DocumentExtraction>> {
  if (!isSupportedDocument(input.mimeType)) {
    throw new Error(`Type de fichier non pris en charge : ${input.mimeType}`);
  }

  if (isMockMode()) {
    return {
      data: mockExtractFromDocument({ filename: input.filename }),
      model: "mock",
      tokensIn: 0,
      tokensOut: 0,
      escalated: false,
    };
  }

  const provider = requireProvider();
  const instruction = `${DOCUMENT_USER_PROMPT}
Nom du fichier d'origine : ${input.filename}`;

  if (provider === "mistral") {
    // PDF envoyé tel quel ; si le modèle le refuse, repli sur Mistral OCR
    // puis analyse du texte extrait. Images : envoyées telles quelles.
    let ocrText: string | null = null;
    let direct = true;
    const contentFor = async () => {
      if (input.mimeType !== PDF) {
        return [
          { type: "image_url" as const, imageUrl: `data:${input.mimeType};base64,${input.base64}` },
          { type: "text" as const, text: instruction },
        ];
      }
      if (direct) {
        return [
          {
            type: "document_url" as const,
            documentUrl: `data:application/pdf;base64,${input.base64}`,
            documentName: input.filename,
          },
          { type: "text" as const, text: instruction },
        ];
      }
      ocrText ??= await mistralOcrText(input.base64);
      // Borne de taille : une facture tient en quelques pages ; au-delà, le
      // début suffit à classer et évite une requête démesurée.
      return `${instruction}

Contenu du document (texte extrait) :
${ocrText.slice(0, 60_000)}`;
    };

    return withEscalation(provider, async (model) => {
      const call = async () =>
        mistralJson({
          model,
          schema: DocumentExtractionSchema,
          schemaName: "extraction_document",
          system: CLASSIFY_DOCUMENT_SYSTEM,
          content: await contentFor(),
        });
      try {
        const result = await call();
        return { ...result, model: direct ? model : `${model}+ocr`, escalated: false };
      } catch (error) {
        if (input.mimeType !== PDF || !direct) throw error;
        direct = false;
        const result = await call();
        return { ...result, model: `${model}+ocr`, escalated: false };
      }
    });
  }

  const client = getAnthropic();

  const fileBlock =
    input.mimeType === PDF
      ? ({
          type: "document",
          source: {
            type: "base64",
            media_type: PDF,
            data: input.base64,
          },
        } as const)
      : ({
          type: "image",
          source: {
            type: "base64",
            media_type: input.mimeType as (typeof IMAGES)[number],
            data: input.base64,
          },
        } as const);

  return withEscalation(provider, async (model) => {
    const response = await client.messages.parse({
      model,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: CLASSIFY_DOCUMENT_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          // Le fichier avant la consigne : c'est l'ordre recommandé pour les
          // documents, et il donne de meilleurs résultats.
          content: [
            fileBlock,
            {
              type: "text",
              text: `${DOCUMENT_USER_PROMPT}\nNom du fichier d'origine : ${input.filename}`,
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(DocumentExtractionSchema) },
    });

    const data = response.parsed_output;
    if (!data) throw new Error(`Extraction document illisible (${model})`);

    return {
      data,
      model,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      escalated: false,
    };
  });
}
