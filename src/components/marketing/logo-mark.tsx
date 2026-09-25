import { Send } from "lucide-react";

/**
 * Pictogramme de la marque.
 *
 * Un aplat, sans dégradé ni halo ni pulsation. Le carré violet lumineux qui
 * respire est l'un des tics les plus répandus des interfaces générées ; un
 * logo qui s'anime attire l'œil là où il n'y a rien à faire.
 *
 * Partagé entre l'en-tête, le pied de page et la connexion, pour qu'il ne
 * puisse plus diverger d'un endroit à l'autre.
 */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[7px] bg-[var(--accent)]"
      style={{ width: size, height: size }}
    >
      <Send
        className="text-[var(--ink)]"
        style={{ width: size * 0.5, height: size * 0.5 }}
        strokeWidth={2.4}
      />
    </span>
  );
}
