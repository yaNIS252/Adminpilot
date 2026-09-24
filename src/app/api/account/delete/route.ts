import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { getStripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Suppression de compte — droit à l'effacement (RGPD, art. 17).
 *
 * Déroulé, dans cet ordre précis :
 *  1. annulation de l'abonnement Stripe — sinon l'utilisateur continue d'être
 *     débité pour un compte qui n'existe plus, ce qui est le pire scénario ;
 *  2. suppression des fichiers R2 ;
 *  3. suppression du compte auth, qui fait tomber tout le reste en cascade.
 *
 * Pas de suppression douce ici : `deleted_at` sert à masquer un compte, pas à
 * satisfaire une demande d'effacement. Conserver les données d'une personne qui
 * a demandé leur suppression n'est pas conforme.
 */

const BodySchema = z.object({
  /** L'utilisateur retape son adresse : garde-fou contre le clic accidentel. */
  confirmEmail: z.string().email(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "requête invalide" }, { status: 400 });
  }

  if (
    parsed.data.confirmEmail.toLowerCase().trim() !==
    auth.profile.email.toLowerCase().trim()
  ) {
    return NextResponse.json(
      { error: "l'adresse saisie ne correspond pas au compte" },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  // 1. Couper la facturation avant tout le reste.
  if (auth.profile.stripe_sub_id) {
    try {
      await getStripe().subscriptions.cancel(auth.profile.stripe_sub_id);
    } catch {
      // Abonnement déjà annulé ou introuvable : rien ne justifie d'interrompre
      // une demande d'effacement pour autant.
    }
  }

  // 2. Fichiers stockés. La clé R2 est préfixée par l'identifiant utilisateur,
  //    donc tout ce qui lui appartient vit sous un seul préfixe.
  const { data: documents } = await db
    .from("documents")
    .select("file_url")
    .eq("user_id", auth.userId);

  const { data: jobs } = await db
    .from("ingestion_jobs")
    .select("raw_url")
    .eq("user_id", auth.userId);

  const keys = [
    ...(documents ?? []).map((d) => d.file_url),
    ...(jobs ?? []).map((j) => j.raw_url),
  ].filter((key): key is string => Boolean(key));

  const { deleteRaw } = await import("@/lib/storage");
  await Promise.allSettled(keys.map((key) => deleteRaw(key)));

  // 3. Le compte auth. Les ON DELETE CASCADE emportent profil, abonnements,
  //    documents, alertes, résiliations et compteurs.
  const { error } = await db.auth.admin.deleteUser(auth.userId);
  if (error) throw error;

  return NextResponse.json({ deleted: true, filesRemoved: keys.length });
}
