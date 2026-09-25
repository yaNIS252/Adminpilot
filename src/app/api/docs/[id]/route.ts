import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/require-user";
import { invalidId, readUuid } from "@/lib/http/request";
import { deleteRaw, getSignedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Consultation et suppression d'un document.
 *
 * L'URL de consultation est signée et expire en une heure : le bucket n'est
 * jamais public. Un document administratif porte nom, adresse, références de
 * contrat et parfois coordonnées bancaires — une URL permanente suffirait à
 * tout exposer si elle fuitait dans un historique ou un presse-papier.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const id = readUuid((await params).id);
  if (!id) return invalidId();

  const supabase = await createClient();

  // Lecture sous RLS : un document appartenant à un autre compte ne remonte
  // pas, donc aucune URL signée ne peut être émise pour lui.
  const { data: document } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!document) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    document,
    url: await getSignedUrl(document.file_url),
    expiresIn: 3600,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const id = readUuid((await params).id);
  if (!id) return invalidId();

  const supabase = await createClient();

  const { data: document } = await supabase
    .from("documents")
    .select("file_url")
    .eq("id", id)
    .maybeSingle();

  if (!document) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  // La ligne d'abord, le fichier ensuite. Dans l'autre sens, un échec de
  // suppression en base laisserait une entrée pointant vers un fichier absent.
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "suppression impossible" },
      { status: 500 },
    );
  }

  await supabase
    .from("alerts")
    .delete()
    .eq("ref_type", "document")
    .eq("ref_id", id)
    .is("sent_at", null);

  // Échec sans gravité : le cron de purge repassera sur les fichiers orphelins.
  await deleteRaw(document.file_url).catch(() => {});

  return NextResponse.json({ deleted: true });
}
