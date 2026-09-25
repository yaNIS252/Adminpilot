import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { MODEL_FAST, getAnthropic } from "@/lib/ai/client";
import { SearchFiltersSchema } from "@/lib/ai/schemas";
import { requireUser } from "@/lib/auth/require-user";
import { checkLimit, incrementUsage } from "@/lib/billing/quotas";
import { readJson } from "@/lib/http/request";
import { consume, tooManyRequests } from "@/lib/rate-limit";
import { SEARCH_QUERY_SYSTEM } from "@/prompts/search-query";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Recherche en langage naturel.
 *
 * Le modèle ne génère PAS de SQL : il produit des filtres structurés que le
 * serveur applique lui-même. Laisser un modèle écrire la requête ouvrirait une
 * injection triviale — il suffirait d'écrire l'instruction voulue dans la barre
 * de recherche.
 */

const BodySchema = z.object({ query: z.string().min(1).max(300) });

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  if (!(await consume("search", auth.userId))) {
    return tooManyRequests("search");
  }

  const quota = await checkLimit(auth.userId, auth.profile.plan, "searches");
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "quota atteint", feature: "searches", ...quota },
      { status: 402 },
    );
  }

  const body = await readJson(request, BodySchema);
  if (!body.ok) return body.response;

  const response = await getAnthropic().messages.parse({
    model: MODEL_FAST,
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: SEARCH_QUERY_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Date du jour : ${new Date().toISOString().slice(0, 10)}\nRecherche : ${body.data.query}`,
      },
    ],
    output_config: { format: zodOutputFormat(SearchFiltersSchema) },
  });

  const filters = response.parsed_output;
  if (!filters) {
    return NextResponse.json(
      { error: "recherche incomprise" },
      { status: 422 },
    );
  }

  const supabase = await createClient();
  let query = supabase.from("documents").select("*").limit(50);

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.date_from) query = query.gte("created_at", filters.date_from);
  if (filters.date_to) query = query.lte("created_at", `${filters.date_to}T23:59:59Z`);

  // Le fournisseur et les mots-clés passent par l'index full-text français.
  // `plainto_tsquery` traite la saisie comme du texte, jamais comme une
  // expression de recherche : aucun opérateur ne peut être injecté.
  const terms = [filters.provider, filters.keywords].filter(Boolean).join(" ");
  if (terms) {
    query = query.textSearch("search_vector", terms, {
      type: "plain",
      config: "french",
    });
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;

  await incrementUsage(auth.userId, "searches");

  return NextResponse.json({ filters, documents: data });
}
