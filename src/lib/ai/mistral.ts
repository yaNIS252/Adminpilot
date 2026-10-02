import "server-only";

import type { ContentChunk } from "@mistralai/mistralai/models/components";
import { z } from "zod";

import { MISTRAL_OCR_MODEL, getMistral } from "./client";

/**
 * Appel Mistral à sortie structurée.
 *
 * Le schéma JSON envoyé est dérivé des schémas zod du projet (schemas.ts),
 * et la réponse est revalidée par ces mêmes schémas : une seule source de
 * vérité, et rien n'entre en base sans avoir été contrôlé ici.
 */

/**
 * Retire les mots-clés que la sortie structurée n'a pas besoin de connaître
 * (formats, motifs, méta-schéma) : la validation complète est faite par zod
 * au retour, et un mot-clé non pris en charge ferait refuser la requête.
 */
function simplify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(simplify);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema" || key === "pattern" || key === "format") continue;
    out[key] = simplify(value);
  }
  return out;
}

export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  return simplify(z.toJSONSchema(schema)) as Record<string, unknown>;
}

function textOf(content: string | ContentChunk[] | null | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .map((chunk) => (chunk.type === "text" && "text" in chunk ? chunk.text : ""))
    .join("");
}

export type MistralResult<T> = { data: T; tokensIn: number; tokensOut: number };

export async function mistralJson<T>(input: {
  model: string;
  schema: z.ZodType<T>;
  schemaName: string;
  system: string;
  content: string | ContentChunk[];
  maxTokens?: number;
}): Promise<MistralResult<T>> {
  const response = await getMistral().chat.complete({
    model: input.model,
    temperature: 0,
    maxTokens: input.maxTokens ?? 1024,
    responseFormat: {
      type: "json_schema",
      jsonSchema: {
        name: input.schemaName,
        schemaDefinition: jsonSchemaOf(input.schema),
        strict: true,
      },
    },
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.content },
    ],
  });

  const raw = textOf(response.choices?.[0]?.message?.content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Réponse Mistral illisible (${input.model})`);
  }

  const result = input.schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Réponse Mistral hors schéma (${input.model})`);
  }

  return {
    data: result.data,
    tokensIn: response.usage?.promptTokens ?? 0,
    tokensOut: response.usage?.completionTokens ?? 0,
  };
}

/**
 * Texte d'un PDF par Mistral OCR, page par page en Markdown. Sert de repli
 * quand le modèle de conversation n'accepte pas le fichier brut.
 */
export async function mistralOcrText(base64Pdf: string): Promise<string> {
  const response = await getMistral().ocr.process({
    model: MISTRAL_OCR_MODEL,
    document: {
      type: "document_url",
      documentUrl: `data:application/pdf;base64,${base64Pdf}`,
    },
  });
  return response.pages.map((page) => page.markdown).join("\n\n");
}
