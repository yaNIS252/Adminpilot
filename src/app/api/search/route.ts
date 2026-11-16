import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { MODELS, aiProvider, getAnthropic, isAiConfigured } from "@/lib/ai/client";
import { mistralJson } from "@/lib/ai/mistral";
import { SearchFiltersSchema, type SearchFilters } from "@/lib/ai/schemas";
import { requireUser } from "@/lib/auth/require-user";
import { checkLimit, incrementUsage } from "@/lib/billing/quotas";
import { readJson } from "@/lib/http/request";
import { consume, tooManyRequests } from "@/lib/rate-limit";
import { matchScore, queryTerms, wordsOf } from "@/lib/search/fuzzy";
import { parseSearchQuery } from "@/lib/search/parse-query";
import { createClient } from "@/lib/supabase/server";
import { SEARCH_QUERY_SYSTEM } from "@/prompts/search-query";

export const runtime = "nodejs";

/**
 * Recherche dans les documents, en français courant.
 *
 * La requête est d'abord lue sans modèle (`parseSearchQuery`) ; le modèle,
 * s'il est configuré, l'affine pour les formulations libres. Dans les deux cas
 * il ne produit que des filtres que le serveur applique lui-même, jamais de
 * SQL : sinon il suffirait d'écrire l'instruction voulue dans la barre de
 * recherche.
 */

const BodySchema = z.object({ query: z.string().trim().min(1).max(300) });

/** Documents examinés, au plus : bien au-delà de ce qu'un foyer accumule. */
const CANDIDATES = 2000;

/** Tous les textes d'une valeur extraite (fournisseur, références, lignes…). */
function textsOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (typeof value === "number") out.push(String(value));
  else if (Array.isArray(value)) for (const item of value) textsOf(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) textsOf(item, out);
  return out;
}

async function filtersFromModel(query: string): Promise<SearchFilters | null> {
  const content = `Date du jour : ${new Date().toISOString().slice(0, 10)}
Recherche : ${query}`;
  try {
    if (aiProvider() === "mistral") {
      const { data } = await mistralJson({
        model: MODELS.mistral.fast,
        schema: SearchFiltersSchema,
        schemaName: "filtres_recherche",
        system: SEARCH_QUERY_SYSTEM,
        content,
        maxTokens: 512,
      });
      return data;
    }
    const response = await getAnthropic().messages.parse({
      model: MODELS.anthropic.fast,
      max_tokens: 512,
      system: [{ type: "text", text: SEARCH_QUERY_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Date du jour : ${new Date().toISOString().slice(0, 10)}\nRecherche : ${query}`,
        },
      ],
      output_config: { format: zodOutputFormat(SearchFiltersSchema) },
    });
    return response.parsed_output ?? null;
  } catch (error) {
    // Le modèle est un plus : en cas d'échec, la lecture locale suffit.
    console.error("[search] modèle indisponible", error instanceof Error ? error.message : error);
    return null;
  }
}

type Extracted = { document_date?: string | null; amount?: number | null } | null;

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const body = await readJson(request, BodySchema);
  if (!body.ok) return body.response;

  const quota = await checkLimit(auth.userId, auth.profile.plan, "searches");
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "quota atteint", feature: "searches", ...quota },
      { status: 402 },
    );
  }

  if (!(await consume("search", auth.userId))) {
    return tooManyRequests("search");
  }

  const local = parseSearchQuery(body.data.query);
  const fromModel = isAiConfigured() ? await filtersFromModel(body.data.query) : null;
  const filters = fromModel ?? local;

  const supabase = await createClient();
  let query = supabase
    .from("documents")
    .select("id, filename_ai, filename_original, category, deadline, mime_type, extracted_data, created_at")
    .order("created_at", { ascending: false })
    .limit(CANDIDATES);

  if (filters.category) query = query.eq("category", filters.category);

  const { data, error } = await query;
  if (error) throw error;

  // Date et montant se lisent dans les données extraites : « ma facture de
  // mars » parle de la date du document, pas du jour où il a été déposé.
  // Fournisseur et mots restants : comparés ici, mot à mot, en tolérant les
  // fautes de frappe et les mots commencés (voir fuzzy.ts). Les meilleures
  // correspondances d'abord, puis les plus récentes.
  const terms = queryTerms([filters.provider, filters.keywords].filter(Boolean).join(" "));
  const scored = (data ?? [])
    .map((doc) => {
      const words = wordsOf(
        [doc.filename_ai ?? "", doc.filename_original, doc.category, ...textsOf(doc.extracted_data)].join(" "),
      );
      return { doc, score: matchScore(terms, words) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.doc);

  const documents = scored.filter((doc) => {
    const extracted = doc.extracted_data as Extracted;
    const date = extracted?.document_date ?? doc.created_at.slice(0, 10);
    if (filters.date_from && date < filters.date_from) return false;
    if (filters.date_to && date > filters.date_to) return false;

    const amount = typeof extracted?.amount === "number" ? extracted.amount : null;
    if (filters.amount_min !== null && (amount === null || amount < filters.amount_min)) return false;
    if (filters.amount_max !== null && (amount === null || amount > filters.amount_max)) return false;
    return true;
  });

  await incrementUsage(auth.userId, "searches");

  return NextResponse.json({
    filters,
    documents: documents.slice(0, 50),
    total: documents.length,
  });
}
