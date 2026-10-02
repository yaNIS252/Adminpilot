import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/require-user";
import { readUuid } from "@/lib/http/request";
import { NO_AFFILIATION_CATEGORIES } from "@/lib/offers";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Sortie vers une offre du comparateur : le clic est consigné (pour
 * rapprocher les commissions des partenaires), puis l'utilisateur part vers
 * l'offre. Seules les adresses du catalogue sont servies — jamais une URL
 * passée en paramètre, qui ferait de cette route une redirection ouverte.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = readUuid((await params).id);
  const fallback = new URL("/abonnements", request.url);
  if (!id) return NextResponse.redirect(fallback);

  const db = createAdminClient();
  const { data: offer } = await db
    .from("offers")
    .select("id, url, affiliate_url, category, active")
    .eq("id", id)
    .maybeSingle();
  if (!offer?.active) return NextResponse.redirect(fallback);

  const auth = await requireUser();
  await db.from("offer_clicks").insert({ offer_id: offer.id, user_id: auth?.userId ?? null });

  const target =
    offer.affiliate_url && !NO_AFFILIATION_CATEGORIES.has(offer.category)
      ? offer.affiliate_url
      : offer.url;
  if (!target.startsWith("https://")) return NextResponse.redirect(fallback);

  return NextResponse.redirect(target, 302);
}
