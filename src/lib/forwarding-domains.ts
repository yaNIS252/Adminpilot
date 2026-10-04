import "server-only";

import { rootDomain } from "@/lib/cancel/links";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Domaines qui sont AUSSI des messageries grand public. Un filtre « tout ce
 * qui vient de orange.fr » transférerait les e-mails de chaque particulier
 * ayant une adresse @orange.fr — la grand-mère, le voisin — vers nos serveurs
 * et un modèle d'IA : des correspondances privées de tiers, sans rapport avec
 * le service (RGPD, minimisation). Pour eux, seules les adresses d'envoi
 * exactes du fournisseur sont retenues.
 */
const CONSUMER_MAIL_DOMAINS = new Set([
  "orange.fr",
  "wanadoo.fr",
  "free.fr",
  "sfr.fr",
  "neuf.fr",
  "laposte.net",
  "bbox.fr",
  "numericable.fr",
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.fr",
  "hotmail.com",
  "hotmail.fr",
  "live.com",
  "live.fr",
  "msn.com",
  "yahoo.com",
  "yahoo.fr",
  "icloud.com",
  "me.com",
  "aol.com",
  "gmx.fr",
  "gmx.com",
  "proton.me",
  "protonmail.com",
]);

/**
 * Expéditeurs à transférer : le domaine du site de chaque fournisseur et
 * ceux de ses adresses d'envoi connues (beaucoup facturent depuis un domaine
 * dédié) ; l'adresse exacte quand le domaine est une messagerie grand public.
 */
export async function forwardingDomains(): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from("known_providers")
    .select("domain, sender_emails");
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
