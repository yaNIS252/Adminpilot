/**
 * N'accepte qu'un chemin interne (« /reglages », « /abonnements/… »). Le
 * paramètre vient du navigateur, donc de n'importe qui : un chemin absolu
 * transformerait nos redirections en tremplin d'hameçonnage. L'antislash est
 * rejeté car les navigateurs le normalisent en slash — `/\exemple.fr`
 * devient `//exemple.fr`, c'est-à-dire une URL absolue.
 */
export function safeReturnPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

/** Ajoute des paramètres à un chemin qui en a peut-être déjà. */
export function withParams(path: string, params: string): string {
  const [base, hash] = path.split("#");
  return `${base}${base.includes("?") ? "&" : "?"}${params}${hash ? `#${hash}` : ""}`;
}
