/**
 * Photo de profil, ou initiales à défaut.
 *
 * `<img>` et non `next/image` : l'URL est signée et expire au bout d'une
 * heure, l'optimiseur d'images la mettrait en cache sous une clé qui change à
 * chaque rendu sans rien y gagner.
 */
export function Avatar({
  name,
  url,
  size = 34,
}: {
  name: string;
  url: string | null;
  size?: number;
}) {
  const initials = name
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-[var(--border-strong)] object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] font-semibold text-[var(--accent-lighter)]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </span>
  );
}
