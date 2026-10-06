import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Liens de résiliation et rattachement au catalogue des fournisseurs.
 *
 * Un lien « gérer mon abonnement » trouvé dans un e-mail est une aide
 * précieuse — c'est souvent le chemin le plus court pour résilier — mais
 * aussi le vecteur classique de l'hameçonnage : un faux e-mail « Netflix »
 * pointe vers netflix-compte-suspendu.xyz. On ne propose donc un lien que
 * s'il mène au domaine du fournisseur lui-même, et on affiche toujours ce
 * domaine en clair à côté du bouton.
 */

/**
 * Domaine enregistrable, approché par les deux derniers libellés :
 * `mail.netflix.com` → `netflix.com`. Suffisant pour les domaines en .fr,
 * .com, .net rencontrés ici ; un suffixe à deux niveaux (`.co.uk`) donnerait
 * un domaine trop large, ce qui ne ferait que refuser plus de liens.
 */
export function rootDomain(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, "").split(".").filter(Boolean);
  return labels.slice(-2).join(".");
}

/** Domaine de l'expéditeur d'un e-mail (`Netflix <info@mailer.netflix.com>`). */
export function senderDomain(from: string): string | null {
  const match = /@([a-z0-9.-]+\.[a-z]{2,})/i.exec(from);
  return match ? rootDomain(match[1]) : null;
}

/**
 * Le lien est-il sûr à proposer ? HTTPS uniquement, et hôte égal à l'un des
 * domaines de confiance ou sous-domaine de celui-ci — jamais un simple
 * « contient » : `netflix.com.evil.io` contient `netflix.com`.
 */
export function trustedLink(
  url: string | null | undefined,
  domains: (string | null | undefined)[],
): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const allowed = domains
    .filter((domain): domain is string => Boolean(domain))
    .map((domain) => domain.toLowerCase());

  const ok = allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
  return ok ? parsed.toString() : null;
}

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Mots significatifs d'un nom commercial (« Amazon Prime » → amazon, prime). */
function words(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);
}

/** Les deux noms partagent au moins un mot significatif. */
function sameBrand(a: string, b: string): boolean {
  const left = new Set(words(a));
  return words(b).some((word) => left.has(word));
}

export type CatalogueMatch = { id: string; domain: string };

/**
 * Fournisseur du catalogue correspondant à un abonnement détecté.
 *
 * Nom commercial exact d'abord ; sinon adresse ou domaine d'expédition, mais
 * seulement si les noms se recoupent : un même expéditeur vend plusieurs
 * services (amazon.fr envoie Prime, Audible, Kindle…), et rattacher Audible à
 * « Amazon Prime » affichait le guide de résiliation de Prime. Sans ce rattachement, la base légale et le lien
 * officiel de résiliation — vérifiés à la main dans le catalogue — restaient
 * inaccessibles pour tout abonnement détecté automatiquement.
 */
export async function matchCatalogue(
  db: Db,
  input: { provider: string; from?: string | null },
): Promise<CatalogueMatch | null> {
  const { data } = await db
    .from("known_providers")
    .select("id, name, domain, sender_emails");
  const providers = data ?? [];

  const from = input.from?.toLowerCase() ?? "";
  const address = /<([^>]+)>/.exec(from)?.[1] ?? from.trim();
  const domain = input.from ? senderDomain(input.from) : null;
  const name = normalize(input.provider);

  const found =
    providers.find((p) => normalize(p.name) === name) ??
    providers.find(
      (p) =>
        address &&
        p.sender_emails.some((e) => e.toLowerCase() === address) &&
        sameBrand(p.name, input.provider),
    ) ??
    providers.find(
      (p) => domain && rootDomain(p.domain) === domain && sameBrand(p.name, input.provider),
    );

  return found ? { id: found.id, domain: rootDomain(found.domain) } : null;
}
