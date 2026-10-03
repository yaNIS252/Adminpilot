import type { NextConfig } from "next";

/**
 * En-têtes de sécurité, sur toutes les réponses.
 *
 * La politique de contenu (CSP) limite ce qu'un script injecté pourrait
 * faire : il ne pourrait ni charger de code venu d'ailleurs, ni envoyer de
 * données à un autre domaine que ceux du service. `unsafe-inline` reste
 * nécessaire aux scripts d'hydratation de Next.js tant qu'on ne passe pas
 * par des nonces ; `unsafe-eval` n'est accordé qu'en développement.
 */
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabase.replace(/^https:/, "wss:");
const dev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Photos de profil et aperçus servis par URL signée depuis Supabase.
  `img-src 'self' data: blob: ${supabase}`,
  "font-src 'self' data:",
  // Supabase (API + temps réel de l'onboarding) et Sentry (rapports d'erreur).
  `connect-src 'self' ${supabase} ${supabaseWs} https://*.ingest.sentry.io https://*.ingest.de.sentry.io`,
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Empêche d'afficher le site dans un cadre (détournement de clic).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Les adresses internes (jetons d'invitation, identifiants) ne fuient pas
  // vers les sites externes ouverts depuis l'application.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
