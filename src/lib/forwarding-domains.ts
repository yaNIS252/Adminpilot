import "server-only";

import { rootDomain } from "@/lib/cancel/links";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Domaines d'expédition à transférer : celui du site de chaque fournisseur du
 * catalogue et ceux de ses adresses d'envoi connues — beaucoup envoient leurs
 * factures depuis un domaine dédié.
 */
export async function forwardingDomains(): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from("known_providers")
    .select("domain, sender_emails");
  if (error) throw error;

  const domains = (data ?? []).flatMap((provider) => [
    rootDomain(provider.domain),
    ...provider.sender_emails.map((email) => rootDomain(email.split("@")[1] ?? "")),
  ]);
  return [...new Set(domains.filter(Boolean))].sort();
}
