import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { REFERRAL_COOKIE } from "@/lib/constants";
import { attachReferral } from "@/lib/referral/engine";
import { clientIp } from "@/lib/referral/normalize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  sessionCookieValue,
} from "@/lib/auth/session";

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
 *
 * L'antislash doit être rejeté explicitement : la spécification URL du WHATWG
 * le normalise en slash pour les schémas spéciaux, si bien que `/\exemple.fr`
 * franchit les deux premiers tests puis devient `https://exemple.fr` une fois
 * passé dans `new URL()`. Le `%5c` encodé est déjà décodé par
 * `searchParams.get`, il est donc couvert par le même test.
 */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//") || value.includes("\\")) return "/dashboard";
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

  // Lien de parrainage suivi avant l'inscription : le compte tout juste créé
  // est rattaché au parrain. Sans effet pour un compte existant. Un échec ne
  // doit jamais bloquer la connexion.
  const referralCode = (await cookies()).get(REFERRAL_COOKIE)?.value;
  if (referralCode) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await attachReferral({
          db: createAdminClient(),
          userId: user.id,
          code: referralCode,
          ip: clientIp(request.headers),
        });
      }
    } catch (error) {
      console.error("[auth/callback] parrainage:", error);
    }
  }

  // Nouvelle connexion : le compteur de durée de session repart de zéro.
  const response = NextResponse.redirect(new URL(next, url.origin));
  if (referralCode) response.cookies.delete(REFERRAL_COOKIE);
  const now = Date.now();
  response.cookies.set(SESSION_COOKIE, sessionCookieValue(now, now), SESSION_COOKIE_OPTIONS);
  return response;
}
