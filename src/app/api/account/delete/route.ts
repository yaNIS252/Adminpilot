import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { getStripe } from "@/lib/billing/stripe";
import { readJson } from "@/lib/http/request";
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

  const body = await readJson(request, BodySchema);
  if (!body.ok) return body.response;

  if (
    body.data.confirmEmail.toLowerCase().trim() !==
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

  // Les lettres de résiliation sont stockées comme les documents, mais dans une
  // table à part : elles étaient oubliées de la purge. Or ce sont les fichiers
  // les plus identifiants du produit — nom, adresse postale complète et
  // référence de contrat de la personne. Les laisser derrière soi après une
  // demande d'effacement est exactement ce que l'article 17 interdit.
  const { data: letters } = await db
    .from("cancellations")
    .select("letter_url")
    .eq("user_id", auth.userId);

  const keys = [
    ...(documents ?? []).map((d) => d.file_url),
    ...(jobs ?? []).map((j) => j.raw_url),
    ...(letters ?? []).map((l) => l.letter_url),
  ].filter((key): key is string => Boolean(key));

  const { deleteRaw } = await import("@/lib/storage");
  await Promise.allSettled(keys.map((key) => deleteRaw(key)));

  // 3. Le compte auth. Les ON DELETE CASCADE emportent profil, abonnements,
  //    documents, alertes, résiliations et compteurs.
  const { error } = await db.auth.admin.deleteUser(auth.userId);
  if (error) throw error;

  return NextResponse.json({ deleted: true, filesRemoved: keys.length });
}
