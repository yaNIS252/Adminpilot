import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, sessionCookieValue } from "@/lib/auth/session";
import { REFERRAL_COOKIE } from "@/lib/constants";
import { attachReferral } from "@/lib/referral/engine";
import { clientIp } from "@/lib/referral/normalize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Fin d'une connexion faite sur la page elle-même (mot de passe ou code reçu
 * par e-mail), sans passer par `/auth/callback` : même travail que lui.
 * Le compteur de durée de session repart de zéro, et un lien de parrainage
 * suivi avant l'inscription rattache le compte à son parrain.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const referralCode = (await cookies()).get(REFERRAL_COOKIE)?.value;
  if (referralCode) {
    try {
      await attachReferral({
        db: createAdminClient(),
        userId: user.id,
        code: referralCode,
        ip: clientIp(request.headers),
      });
    } catch (error) {
      console.error("[auth/session] parrainage:", error);
    }
  }

  const response = NextResponse.json({ ok: true });
  if (referralCode) response.cookies.delete(REFERRAL_COOKIE);
  const now = Date.now();
  response.cookies.set(SESSION_COOKIE, sessionCookieValue(now, now), SESSION_COOKIE_OPTIONS);
  return response;
}
