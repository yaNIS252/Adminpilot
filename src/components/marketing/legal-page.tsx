import Link from "next/link";

/**
 * Gabarit commun aux pages légales.
 *
 * Elles partagent toutes la même forme : un titre, une date de mise à jour, des
 * blocs numérotés, et la navigation croisée vers les autres. Les centraliser
 * évite qu'elles divergent au fil des retouches.
 */

export const LEGAL_PAGES = [
  { href: "/legal/confidentialite", label: "Confidentialité" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/cgu", label: "Conditions d’utilisation" },
  { href: "/legal/mentions-legales", label: "Mentions légales" },
] as const;

export function LegalLayout({
  title,
  intro,
  updated,
  current,
  children,
}: {
  title: string;
  intro: string;
  /** Date de dernière mise à jour, au format lisible. */
  updated: string;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[760px] px-5 pt-16 pb-10">
      <h1 className="serif m-0 text-[clamp(40px,7vw,64px)] leading-[1.02]">
        {title}
      </h1>
      <p className="mt-3 mb-1 text-[17px] text-pretty text-[var(--text-dim)]">
        {intro}
      </p>
      <p className="mono m-0 text-xs text-[var(--text-ghost)]">
        Dernière mise à jour : {updated}
      </p>

      <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--border)]">
        {LEGAL_PAGES.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            aria-current={page.href === current ? "page" : undefined}
            className={`-mb-px border-b-2 pb-3 text-[13px] font-medium no-underline transition-colors ${
              page.href === current
                ? "border-[var(--text-bright)] text-[var(--text-bright)]"
                : "border-transparent text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            {page.label}
          </Link>
        ))}
      </nav>

      <div className="mt-10">{children}</div>
    </main>
  );
}

export function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-9">
      <h2 className="mt-0 mb-2.5 text-[17px] font-semibold">{title}</h2>
      <div className="space-y-2.5 text-[15px] leading-[1.7] text-pretty text-[var(--text-dim)]">
        {children}
      </div>
    </section>
  );
}

/**
 * Encadré signalant une information que l'exploitant doit compléter avant
 * l'ouverture au public. Visible volontairement : une mention légale
 * incomplète mise en ligne est une infraction, pas un détail cosmétique.
 */
export function ToComplete({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 rounded-[var(--radius-sm)] border border-[rgba(224,161,56,.35)] bg-[rgba(224,161,56,.07)] px-3.5 py-2.5 text-sm text-[var(--warning-light)]">
      À compléter avant la mise en ligne : {children}
    </p>
  );
}
