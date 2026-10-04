import { NextResponse } from "next/server";

import { REFERRAL_COOKIE } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * Lien de parrainage : /p/<code>.
 *
 * Mémorise le code dans un cookie le temps de l'inscription, puis envoie vers
 * la création de compte. Le code n'est vérifié qu'au rattachement : ici, un
 * code inconnu ne coûte rien et ne révèle pas quels codes existent.
 *
 * Cookie strictement nécessaire au service demandé (le parrainage) : il ne
 * sert à rien d'autre et disparaît à l'inscription.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const response = NextResponse.redirect(new URL("/login?mode=signup", request.url));

  if (/^[a-z0-9]{6,32}$/i.test(code)) {
    response.cookies.set(REFERRAL_COOKIE, code.toLowerCase(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 86_400,
    });
  }
  return response;
}
