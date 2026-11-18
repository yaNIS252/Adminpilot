import "server-only";

import { rootDomain } from "@/lib/cancel/links";
import { forwardingDomains } from "@/lib/forwarding-domains";
import { normalizeProvider } from "@/lib/ingest/pipeline";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * L'e-mail vient-il d'un expéditeur inconnu ?
 *
 * Le filtre « mots-clés » transfère toute facture, même d'un expéditeur hors
 * catalogue (IONOS, un artisan, une salle de sport…). Pour eux, rien n'est
 * créé d'office : la pièce jointe attend que l'utilisateur la garde. Tout le
 * reste suit le chemin habituel, inchangé :
 *  · un transfert fait à la main (depuis sa propre adresse, ou un « Fwd: ») —
 *    l'utilisateur a choisi de l'envoyer ;
 *  · un expéditeur du catalogue, donc du filtre principal ;
 *  · un fournisseur déjà suivi (domaine de son site ou de son espace client,
 *    ou même nom).
 * Dans le doute (adresse illisible), l'e-mail est tenu pour connu : mieux
 * vaut le chemin habituel qu'une facture mise de côté à tort.
 */

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

const FORWARDED_SUBJECT = /^\s*(?:fwd?|tr|fw|wg|rv)\s*:/i;
const FORWARDED_BODY =
  /(?:message transf[ée]r[ée]|forwarded message|message d'origine|original message)/i;

function addressOf(value: string): string | null {
  const bracketed = /<([^>]+)>/.exec(value)?.[1];
  const match = EMAIL.exec(bracketed ?? value);
  return match ? match[0].toLowerCase() : null;
}

/** Nom affiché de l'expéditeur : « IONOS » dans `IONOS <noreply@ionos.fr>`. */
function displayName(value: string): string | null {
  const name = /^\s*"?([^"<]+?)"?\s*</.exec(value)?.[1]?.trim();
  return name || null;
}

function hostRoot(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    return rootDomain(new URL(value).hostname);
  } catch {
    return null;
  }
}

export async function isUnknownSender(
  db: Db,
  input: { userId: string; ownEmail: string; from: string; subject: string; body: string },
): Promise<boolean> {
  const address = addressOf(input.from);
  if (!address) return false;

  if (FORWARDED_SUBJECT.test(input.subject) || FORWARDED_BODY.test(input.body.slice(0, 4000))) {
    return false;
  }

  const { data: mailboxes } = await db.from("mailboxes").select("address").eq("user_id", input.userId);
  const own = new Set([input.ownEmail.toLowerCase(), ...(mailboxes ?? []).map((row) => row.address)]);
  if (own.has(address)) return false;

  const domain = rootDomain(address.split("@")[1] ?? "");
  const criteria = new Set(await forwardingDomains());
  if (criteria.has(address) || criteria.has(domain)) return false;

  const { data: subscriptions } = await db
    .from("subscriptions")
    .select("provider, metadata, known_providers(domain)")
    .eq("user_id", input.userId);
  const name = displayName(input.from);
  const target = name ? normalizeProvider(name) : null;
  for (const sub of subscriptions ?? []) {
    const meta =
      sub.metadata && typeof sub.metadata === "object" && !Array.isArray(sub.metadata)
        ? (sub.metadata as Record<string, unknown>)
        : {};
    const domains = [
      hostRoot(meta.site_url),
      hostRoot(meta.manage_url),
      sub.known_providers?.domain ? rootDomain(sub.known_providers.domain) : null,
    ];
    if (domains.includes(domain)) return false;
    if (target && target.length >= 3 && normalizeProvider(sub.provider) === target) return false;
  }

  return true;
}
