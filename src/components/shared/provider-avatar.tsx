/**
 * Pastille de fournisseur.
 *
 * Pas de logos : les récupérer supposerait de les héberger, de gérer les
 * marques et leurs droits, et de tomber en panne d'image pour tout fournisseur
 * hors catalogue. Une initiale colorée fonctionne toujours.
 *
 * La teinte est dérivée du nom, donc stable : EDF aura toujours la même
 * couleur, d'un écran à l'autre et d'une session à l'autre.
 */
function hueFromName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return hash;
}

export function ProviderAvatar({
  name,
  size = 36,
}: {
  name: string;
  size?: number;
}) {
  const hue = hueFromName(name);

  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        // Saturation et luminosité fixes : seule la teinte varie, ce qui garde
        // un contraste homogène quelle que soit la couleur tirée.
        background: `hsl(${hue} 55% 22%)`,
        color: `hsl(${hue} 85% 72%)`,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
