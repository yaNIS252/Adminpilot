import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { invalidId, readJson, readUuid } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Gestion des alertes.
 *
 * Les alertes automatiques (J-7, J-1) sont créées par le pipeline. Celles-ci
 * sont les alertes manuelles, et la possibilité pour l'utilisateur de désactiver
 * ce qui le dérange — un produit qui notifie trop est désinstallé.
 */

const PostSchema = z.object({
  ref_type: z.enum(["subscription", "document"]),
  ref_id: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().max(500).default(""),
  alert_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    // Ni dans le passé (il partirait aussitôt), ni à plus de deux ans.
    .refine((date) => {
      const today = new Date().toISOString().slice(0, 10);
      const limit = new Date(Date.now() + 730 * 86_400_000).toISOString().slice(0, 10);
      return date >= today && date <= limit;
    }, "date hors limites"),
  channel: z.enum(["email", "push", "both"]).default("email"),
});

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const scope = new URL(request.url).searchParams.get("scope") ?? "upcoming";
  const supabase = await createClient();

  let query = supabase
    .from("alerts")
    .select("*")
    .order("alert_date", { ascending: scope === "upcoming" })
    .limit(100);

  if (scope === "upcoming") query = query.is("sent_at", null);
  else if (scope === "sent") query = query.not("sent_at", "is", null);

  const { data, error } = await query;
  if (error) throw error;

  return NextResponse.json({ alerts: data });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const body = await readJson(request, PostSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  const supabase = await createClient();

  // Vérification de propriété de l'objet référencé.
  //
  // Sans elle, rien n'empêchait de créer une alerte pointant vers l'abonnement
  // d'un autre compte : la ligne d'alerte appartenait bien à son auteur, donc
  // RLS la laissait passer, mais le cron d'envoi relit l'objet référencé avec
  // le client de service, qui contourne RLS. L'attaquant recevait par email le
  // fournisseur, le montant et la date de reconduction d'un inconnu.
  //
  // La lecture se fait ici sous l'identité de l'utilisateur : si l'objet ne lui
  // appartient pas, la policy ne le renvoie pas et la requête est refusée.
  const owned = await supabase
    .from(input.ref_type === "subscription" ? "subscriptions" : "documents")
    .select("id")
    .eq("id", input.ref_id)
    .maybeSingle();

  if (!owned.data) {
    return NextResponse.json(
      { error: "objet référencé introuvable" },
      { status: 404 },
    );
  }

  // Écriture avec la clé de service, et seulement ici : l'insertion directe
  // depuis le navigateur est fermée en base (migration 0010), sans quoi un
  // appel à Supabase en direct contournait la vérification ci-dessus.
  const { data, error } = await createAdminClient()
    .from("alerts")
    .insert({
      ...input,
      user_id: auth.userId,
      // Envoyé tel quel, avec le titre et le message saisis.
      kind: "manual",
      // Suffixe aléatoire : une alerte manuelle peut légitimement doublonner
      // une alerte automatique sur la même échéance.
      dedup_key: `manuel:${auth.userId}:${input.ref_id}:${crypto.randomUUID()}`,
    })
    .select("*")
    .single();

  if (error) throw error;

  // Pas de décompte ici : le quota porte sur les alertes ENVOYÉES, et c'est le
  // cron d'envoi qui le tient. Compter aussi à la création ferait payer deux
  // fois la même alerte.
  return NextResponse.json({ alert: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const id = readUuid(new URL(request.url).searchParams.get("id"));
  if (!id) return invalidId();

  const supabase = await createClient();
  // Seules les alertes non envoyées sont supprimables : l'historique de ce qui
  // a réellement été notifié ne doit pas pouvoir être réécrit.
  const { error } = await supabase
    .from("alerts")
    .delete()
    .eq("id", id)
    .is("sent_at", null);

  if (error) throw error;
  return NextResponse.json({ deleted: true });
}
