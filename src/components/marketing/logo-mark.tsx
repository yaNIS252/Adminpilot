/**
 * Pictogramme de la marque : un « A » dont la barre est un avion en papier
 * violet, signe d'un courrier qui part et d'un pilote qui s'en occupe.
 *
 * Redessiné en SVG d'après la planche du logo : le « A » prend la couleur du
 * texte (blanc sur l'application sombre, encre sur fond clair), l'avion garde
 * le violet de la marque, détouré de la couleur du fond pour se détacher.
 *
 * Partagé entre l'en-tête, le pied de page, la connexion et l'application,
 * pour qu'il ne puisse plus diverger d'un endroit à l'autre.
 */
export function LogoMark({
  size = 26,
  className = "text-[var(--text-bright)]",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
    >
      <LogoPaths cutout="var(--bg, #0a0a0f)" />
    </svg>
  );
}

/**
 * Tracés du pictogramme, réutilisés par les icônes de l'application
 * (favicon, écran d'accueil du téléphone).
 */
export function LogoPaths({
  glyph = "currentColor",
  plane = "#6c5ce7",
  cutout,
}: {
  glyph?: string;
  plane?: string;
  cutout: string;
}) {
  return (
    <>
      <path
        d="M40 6h20l38 88H76L57 74 39 70 24 94H2Z"
        fill={glyph}
        stroke={glyph}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path
        d="M70 45 27 59l16 6 7 20Z"
        fill={plane}
        stroke={cutout}
        strokeWidth={6}
        strokeLinejoin="round"
        paintOrder="stroke"
      />
    </>
  );
}
