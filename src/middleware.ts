import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_IDLE_MS,
  SESSION_MAX_MS,
  SESSION_TOUCH_MS,
  readSession,
  sessionCookieValue,
} from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/types";

/**
 * Rafraîchit la session Supabase à chaque requête et protège les routes privées.
 *
 * Le middleware est le seul endroit où les cookies de session peuvent être
 * réécrits de façon fiable : un Server Component ne peut pas en écrire. Sans
 * lui, un jeton expiré déconnecte l'utilisateur au lieu d'être renouvelé.
 */

const PUBLIC_PREFIXES = [
  "/login",
  "/auth",
  "/api/inbound",
  "/api/cron",
  "/api/webhooks",
  // Protégée par CRON_SECRET dans la route elle-même.
  "/api/health",
  "/resilier",
  "/legal",
  // Lien de parrainage : pose un cookie puis renvoie vers l'inscription.
  "/p",
];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  // La réponse doit être construite AVANT le client : c'est sur elle que
  // Supabase pose les cookies rafraîchis.
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // `getUser()` et non `getSession()` : seul le premier revalide le jeton
  // auprès de Supabase. Un cookie de session peut être forgé.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (user) {
    const now = Date.now();
    const session = readSession(request.cookies.get(SESSION_COOKIE)?.value);
    const expired =
      session && (now - session.issued > SESSION_MAX_MS || now - session.seen > SESSION_IDLE_MS);

    if (expired) {
      // Révoque la session côté Supabase et efface ses cookies sur `response`.
      await supabase.auth.signOut({ scope: "local" });
      const out = pathname.startsWith("/api/")
        ? NextResponse.json({ error: "session expirée", code: "session_expired" }, { status: 401 })
        : NextResponse.redirect(new URL("/login?error=session_expiree", request.url));
      for (const cookie of response.cookies.getAll()) out.cookies.set(cookie);
      out.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
      return out;
    }

    // Sessions ouvertes avant cette règle : leur compteur démarre maintenant.
    if (!session || now - session.seen > SESSION_TOUCH_MS) {
      response.cookies.set(
        SESSION_COOKIE,
        sessionCookieValue(session?.issued ?? now, now),
        SESSION_COOKIE_OPTIONS,
      );
    }
  }

  // Supabase renvoie ses erreurs d'authentification (lien expiré, déjà
  // utilisé…) sur le Site URL du projet, c'est-à-dire la page d'accueil, qui
  // les ignorait : l'utilisateur cliquait son lien et se retrouvait sur la
  // vitrine sans comprendre. On les réoriente vers la connexion, qui sait les
  // expliquer.
  const authError = request.nextUrl.searchParams.get("error_code");
  if (pathname === "/" && authError) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("error", authError);
    return NextResponse.redirect(login);
  }

  if (!user && !isPublic(pathname)) {
    // Une route API doit répondre en JSON, jamais par une redirection : un
    // `fetch()` suivrait le 307, recevrait le HTML de la page de connexion, et
    // le `response.json()` échouerait sur une erreur de parsing illisible —
    // l'utilisateur verrait un échec obscur au lieu d'une session expirée.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "session expirée", code: "unauthenticated" },
        { status: 401 },
      );
    }

    const login = request.nextUrl.clone();
    login.pathname = "/login";
    // Mémorise la destination pour y revenir après connexion.
    // Chemin ET paramètres : « /reglages?formule=pro » doit revenir entier,
    // sinon le visiteur qui cliquait « Passer Pro » perd son choix en route.
    // `safeNext` du callback reste le garde-fou contre les redirections
    // ouvertes, quelle que soit la valeur transportée ici.
    login.search = "";
    login.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  if (user && pathname === "/login") {
    const dashboard = request.nextUrl.clone();
    dashboard.pathname = "/dashboard";
    dashboard.search = "";
    return NextResponse.redirect(dashboard);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Tout sauf les ressources statiques : les faire passer par le middleware
     * ajouterait un appel réseau à chaque image servie.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
