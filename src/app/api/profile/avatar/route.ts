import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/require-user";
import { sniffMimeType } from "@/lib/ingest/sniff";
import { AVATAR_BUCKET as BUCKET } from "@/lib/profile/avatar";
import { consume, tooManyRequests } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Photo de profil.
 *
 * Bucket privé `avatars`, un fichier par compte sous `<id>/`. Le nom change à
 * chaque envoi : une URL signée mise en cache par le navigateur ne montrerait
 * sinon jamais la nouvelle photo.
 */

const MAX_BYTES = 2 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  if (!(await consume("avatar", auth.userId))) {
    return tooManyRequests("avatar");
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "fichier manquant" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "image trop lourde (2 Mo maximum)" },
      { status: 413 },
    );
  }

  // Type réel lu dans le contenu, jamais celui annoncé par le navigateur.
  const buffer = Buffer.from(await file.arrayBuffer());
  const type = sniffMimeType(buffer);
  if (!type || !(type in EXTENSIONS)) {
    return NextResponse.json(
      { error: "format non accepté (JPEG, PNG ou WebP)" },
      { status: 415 },
    );
  }

  const db = createAdminClient();
  const path = `${auth.userId}/${crypto.randomUUID()}.${EXTENSIONS[type]}`;

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: type, upsert: false });
  if (uploadError) throw uploadError;

  const { error } = await db
    .from("profiles")
    .update({ avatar_path: path, updated_at: new Date().toISOString() })
    .eq("id", auth.userId);
  if (error) throw error;

  await removePrevious(db, auth.profile.avatar_path);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({ avatar_path: null, updated_at: new Date().toISOString() })
    .eq("id", auth.userId);
  if (error) throw error;

  await removePrevious(db, auth.profile.avatar_path);
  return NextResponse.json({ ok: true });
}

/** Supprime l'ancienne photo. Un échec ici laisse un orphelin, pas une panne. */
async function removePrevious(
  db: ReturnType<typeof createAdminClient>,
  path: string | null,
) {
  if (!path) return;
  await db.storage.from(BUCKET).remove([path]).catch(() => undefined);
}
