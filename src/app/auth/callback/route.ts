import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Retour d'authentification — OAuth Google et lien magique.
 *
 * Supabase renvoie ici avec un `code` à échanger contre une session. Le profil,
 * lui, est créé par le trigger `on_auth_user_created` : rien à faire ici.
 */

/**
 * N'accepte qu'un chemin relatif. Une redirection ouverte permettrait d'envoyer
 * un utilisateur fraîchement authentifié vers un site tiers depuis un lien qui
 * porte le domaine légitime — hameçonnage idéal.
 */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const supabase = await createClient();

  // Deux formats coexistent :
  //   · `code`       — OAuth et PKCE (Google)
  //   · `token_hash` — liens par email, format recommandé par Supabase, qui
  //                    évite de faire transiter le jeton par un redirecteur
  //                    tiers où il finirait dans des journaux d'accès.
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  let failed = true;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "magiclink" | "email" | "recovery" | "invite",
    });
    if (error) console.error("[auth/callback] verifyOtp:", error.status, error.message);
    failed = Boolean(error);
  } else {
    return NextResponse.redirect(
      new URL("/login?error=jeton_manquant", url.origin),
    );
  }

  if (failed) {
    return NextResponse.redirect(
      new URL("/login?error=echec_authentification", url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
