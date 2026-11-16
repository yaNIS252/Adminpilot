/**
 * Affiché dès le clic dans le menu, le temps que la page arrive du serveur.
 *
 * Sans lui, Next.js garde l'ancienne page à l'écran jusqu'à ce que la
 * nouvelle soit entièrement prête : le clic semblait ne rien faire pendant
 * une seconde. La barre latérale, elle, reste en place (elle appartient à la
 * mise en page, pas à la page).
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Chargement">
      <div className="mb-1 h-9 w-48 animate-pulse rounded-lg bg-[rgb(var(--fg-rgb)/.06)]" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div
            key={key}
            className="h-24 animate-pulse rounded-[var(--radius-xl)] border border-[var(--border)] bg-[rgb(var(--fg-rgb)/.02)]"
          />
        ))}
      </div>
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="h-20 animate-pulse rounded-[var(--radius-xl)] border border-[var(--border)] bg-[rgb(var(--fg-rgb)/.02)]"
        />
      ))}
    </div>
  );
}
