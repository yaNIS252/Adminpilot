import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/require-user";
import { checkLimit } from "@/lib/billing/quotas";
import { invalidId, readUuid } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * « Garder » un document en attente (facture d'un expéditeur inconnu) : il
 * rejoint les documents rangés. C'est à ce moment que la limite de documents
 * de la formule s'applique, comme pour un dépôt.
 *
 * Écrit par le serveur seul : `pending_until` n'est pas modifiable depuis le
 * navigateur. La propriété est vérifiée explicitement, la clé de service
 * contournant RLS.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const id = readUuid((await params).id);
  if (!id) return invalidId();

  const db = createAdminClient();
  const { data: document } = await db
    .from("documents")
    .select("id, pending_until")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (!document) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
  if (!document.pending_until) {
    return NextResponse.json({ ok: true });
  }

  const quota = await checkLimit(auth.userId, auth.profile.plan, "documents");
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "limite atteinte", code: "limit", ...quota },
      { status: 402 },
    );
  }

  const { error } = await db
    .from("documents")
    .update({ pending_until: null })
    .eq("id", id)
    .eq("user_id", auth.userId);
  if (error) throw error;

  return NextResponse.json({ ok: true });
}
