import { createHash } from "node:crypto";

/**
 * Forme canonique d'une adresse, pour repérer les variantes d'une même boîte.
 *
 * Gmail ignore les points et tout ce qui suit un « + » dans la partie locale :
 * `jean.dupont+1@gmail.com` et `jeandupont@googlemail.com` arrivent au même
 * endroit. Ailleurs, seule l'étiquette « + » est retirée, convention presque
 * universelle ; les points peuvent y distinguer deux personnes.
 */
export function normalizeEmail(email: string): string {
  const [rawLocal = "", rawDomain = ""] = email.trim().toLowerCase().split("@");
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;
  let local = rawLocal.split("+")[0] ?? "";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/**
 * Empreinte salée. Sert à comparer des adresses (IP, boîte qui transfère)
 * sans jamais les conserver en clair.
 */
export function fingerprint(value: string): string {
  const salt = process.env.REFERRAL_SALT ?? process.env.CRON_SECRET ?? "";
  return createHash("sha256").update(`${salt}:${value}`, "utf8").digest("hex");
}

/** Première adresse de `x-forwarded-for` : celle du visiteur chez Vercel. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || null;
}

/** Nom affiché d'un filleul au parrain : prénom, ou initiale de l'adresse. */
export function refereeLabel(name: string | null, email: string): string {
  const first = name?.trim().split(/\s+/)[0];
  if (first) return first;
  return `${email.charAt(0).toUpperCase()}•••`;
}
