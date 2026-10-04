import "server-only";

import { createHash } from "node:crypto";

import { rootDomain } from "@/lib/cancel/links";
import { CONSUMER_MAIL_DOMAINS } from "@/lib/email/consumer-domains";
import { EXCLUDED_QUERY, KEYWORD_QUERY } from "@/lib/gmail-filter";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Catégories jamais transférées automatiquement. Une banque envoie relevés,
 * alertes de solde, avis d'opération : des données financières sensibles,
 * pour très peu d'abonnements à la clé (les frais de carte apparaissent de
 * toute façon sur les autres factures). Minimisation : on ne les demande pas.
 * L'utilisateur peut toujours transférer un e-mail bancaire à la main.
 */
const EXCLUDED_CATEGORIES = ["banque"];

/**
 * Expéditeurs à transférer : le domaine du site de chaque fournisseur et
 * ceux de ses adresses d'envoi connues (beaucoup facturent depuis un domaine
 * dédié) ; l'adresse exacte quand le domaine est une messagerie grand public.
 */
export async function forwardingDomains(): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from("known_providers")
    .select("domain, sender_emails, category")
    .not("category", "in", `(${EXCLUDED_CATEGORIES.join(",")})`);
  if (error) throw error;

  const criteria = (data ?? []).flatMap((provider) => {
    const site = rootDomain(provider.domain);
    const senders = provider.sender_emails.map((email) => email.trim().toLowerCase());
    return [
      ...(CONSUMER_MAIL_DOMAINS.has(site) ? [] : [site]),
      ...senders.map((email) => {
        const domain = rootDomain(email.split("@")[1] ?? "");
        return CONSUMER_MAIL_DOMAINS.has(domain) ? email : domain;
      }),
    ];
  });
  return [...new Set(criteria.filter(Boolean))].sort();
}

/**
 * Empreinte du filtre Gmail tel qu'on le génère aujourd'hui. Mémorisée au
 * téléchargement : si le catalogue ou les règles changent, l'utilisateur est
 * invité à réimporter son filtre (Gmail ne le met jamais à jour tout seul).
 */
export function filterFingerprint(criteria: string[]): string {
  return createHash("sha256")
    .update(JSON.stringify([criteria, EXCLUDED_QUERY, KEYWORD_QUERY]))
    .digest("hex")
    .slice(0, 16);
}
