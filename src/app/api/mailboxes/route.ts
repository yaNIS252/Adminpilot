import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/require-user";
import { invalidId, readUuid } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Retire une boîte mail de la liste du compte : sa place se libère. */
export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const id = readUuid(new URL(request.url).searchParams.get("id"));
  if (!id) return invalidId();

  const db = createAdminClient();
  const { error } = await db.from("mailboxes").delete().eq("id", id).eq("user_id", auth.userId);
  if (error) throw error;
  await db.from("profiles").update({ mailbox_limit_at: null }).eq("id", auth.userId);
  return NextResponse.json({ removed: true });
}
