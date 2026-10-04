/**
 * Adresses d'expédition.
 *
 * Jamais de « no-reply » : les messageries le lisent comme un envoi de masse
 * auquel personne ne répond, et la réputation du domaine en pâtit (Resend le
 * signale dans ses Insights). Les réponses à ces adresses arrivent sur le
 * domaine de réception et sont relayées vers `SUPPORT_FORWARD_TO`
 * (voir /api/inbound).
 *
 * `connexion@` est réservée aux liens de connexion, envoyés par Supabase
 * (réglage SMTP du tableau de bord Supabase, pas ce code).
 */
export const SENDER_LOCAL_PARTS = ["bonjour", "alertes", "connexion"] as const;

function domain(): string {
  return process.env.INBOUND_DOMAIN ?? "in.zylax.fr";
}

/** Expéditeur des e-mails du service : comptes, foyer, parrainage, facturation. */
export function senderAddress(): string {
  return `AdminPilot <bonjour@${domain()}>`;
}

/** Expéditeur des rappels d'échéance et récapitulatifs. */
export function alertsAddress(): string {
  return `AdminPilot <alertes@${domain()}>`;
}

/** Vrai pour une de nos adresses d'expédition (réponse d'un utilisateur). */
export function isSenderAddress(address: string): boolean {
  const [local = "", host = ""] = address.trim().toLowerCase().split("@");
  return host === domain() && (SENDER_LOCAL_PARTS as readonly string[]).includes(local);
}
