/**
 * URL publique du service.
 *
 * Centralisée parce qu'elle était recopiée avec un repli codé en dur vers
 * `adminpilot.zylax.fr` — un domaine depuis supprimé. Les liens des emails
 * d'alerte et les retours de paiement Stripe pointaient donc vers le vide dès
 * que la variable manquait, sans le moindre signal.
 *
 * `VERCEL_URL` sert de repli : Vercel la renseigne pour tout déploiement, ce
 * qui garantit une URL qui répond même si la configuration est incomplète. En
 * développement, on retombe sur le serveur local.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3100";
}
