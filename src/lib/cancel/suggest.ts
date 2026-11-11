import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { z } from "zod";

import { MODELS } from "@/lib/ai/client";
import { mistralJson } from "@/lib/ai/mistral";

/**
 * Lien de résiliation proposé par un utilisateur, vérifié avant d'être
 * utilisé :
 *
 *  1. https uniquement, sur le domaine du fournisseur ou un sous-domaine ;
 *  2. page récupérée côté serveur sans pouvoir viser notre réseau (SSRF) :
 *     adresses privées, locales et de lien local refusées, 5 s, 500 Ko,
 *     redirections suivies seulement sur les domaines autorisés ;
 *  3. l'IA lit le texte et dit si c'est bien une page de résiliation.
 */

const TIMEOUT_MS = 5000;
const MAX_BYTES = 500 * 1024;
const MAX_REDIRECTS = 3;

export const VerdictSchema = z.object({
  isCancelPage: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});
export type Verdict = z.infer<typeof VerdictSchema>;

/** Le nom d'hôte est-il ce domaine, ou l'un de ses sous-domaines ? */
export function onDomain(host: string, domains: string[]): boolean {
  const name = host.toLowerCase().replace(/\.$/, "");
  return domains.some((domain) => {
    const root = domain.toLowerCase().replace(/^www\./, "");
    return name === root || name.endsWith(`.${root}`);
  });
}

/** Adresse IP interdite : boucle locale, réseau privé, lien local, réservée. */
function forbiddenIp(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = address.toLowerCase();
  if (v6 === "::1" || v6 === "::") return true;
  if (v6.startsWith("::ffff:")) return forbiddenIp(v6.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6);
}

async function assertPublicHost(host: string) {
  if (isIP(host)) throw new Error("adresse IP refusée");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("hôte local refusé");
  }
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some((entry) => forbiddenIp(entry.address))) {
    throw new Error("adresse privée refusée");
  }
}

/** Texte de la page, ou une erreur lisible. */
export async function fetchPageText(url: string, domains: string[]): Promise<string> {
  let current = new URL(url);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (current.protocol !== "https:") throw new Error("https uniquement");
    if (!onDomain(current.hostname, domains)) throw new Error("redirection vers un autre domaine");
    await assertPublicHost(current.hostname);

    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "AdminPilot-LinkCheck/1.0", accept: "text/html" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("redirection sans destination");
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) throw new Error(`page inaccessible (${response.status})`);

    const reader = response.body?.getReader();
    if (!reader) return "";
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const html = Buffer.concat(chunks).toString("utf8");
    return html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
  }
  throw new Error("trop de redirections");
}

const SYSTEM = `Tu vérifies qu'une page web permet à un client de gérer ou de résilier son abonnement chez un fournisseur donné.
Réponds isCancelPage = true si la page est : une page de résiliation, une page « mon abonnement / gérer mon offre » d'où l'on résilie, une page de connexion à l'espace client qui y mène, ou un article d'aide officiel expliquant comment résilier.
Réponds false pour une page d'accueil, une publicité, une page sans rapport, une erreur, ou un autre fournisseur.
confidence : ta certitude de 0 à 1. reason : une phrase en français.`;

export async function judgeCancelPage(input: { provider: string; url: string; text: string }): Promise<Verdict> {
  if (!input.text) {
    return { isCancelPage: false, confidence: 0, reason: "La page ne contient aucun texte lisible." };
  }
  const result = await mistralJson({
    model: MODELS.mistral.fast,
    schema: VerdictSchema,
    schemaName: "verdict_resiliation",
    system: SYSTEM,
    content: `Fournisseur : ${input.provider}\nAdresse : ${input.url}\n\nTexte de la page :\n${input.text}`,
    maxTokens: 300,
  });
  return result.data;
}
