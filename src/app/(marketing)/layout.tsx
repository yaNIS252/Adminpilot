import Link from "next/link";

import { LEGAL_PAGES } from "@/components/marketing/legal-page";
import { LogoMark } from "@/components/marketing/logo-mark";
import { SiteHeader } from "@/components/marketing/site-header";

/**
 * Enveloppe des pages publiques.
 *
 * Plus de grille en fond ni de grand halo violet : ce sont les deux marqueurs
 * les plus reconnaissables des pages d'accueil générées. Il reste une lueur
 * très basse en haut de page, juste assez pour que le noir ne soit pas plat.
 *
 * « Connexion » et « Commencer » restent deux entrées distinctes : les fondre
 * obligerait l'utilisateur déjà inscrit à deviner où cliquer.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `overflow-x-clip` et non `hidden` : `hidden` fabrique un conteneur
    // défilable, et la lueur qui déborde suffisait alors à ce qu'un simple
    // scrollIntoView décale toute la page latéralement. `clip` rogne sans
    // jamais permettre de défilement — et ne casse pas le `position: sticky`
    // de l'en-tête.
    <div className="relative min-h-dvh overflow-x-clip bg-[var(--bg)]">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-420px] left-1/2 ml-[-700px] h-[760px] w-[1400px] bg-[radial-gradient(closest-side,rgba(110,90,240,.11),transparent)]"
      />

      <SiteHeader />

      <div className="relative z-10">{children}</div>

      <footer className="relative z-10 border-t border-[var(--border-soft)]">
        <div className="mx-auto grid max-w-[1160px] gap-10 px-5 py-12 md:grid-cols-[1.2fr_2fr]">
          <div>
            <Link
              href="/"
              className="flex items-center gap-2.5 text-[var(--text)] hover:text-[var(--text)]"
            >
              <LogoMark />
              <span className="font-semibold tracking-[-0.01em]">
                AdminPilot
              </span>
            </Link>
            <p className="mt-4 mb-0 max-w-[300px] text-[13px] leading-[1.6] text-[var(--text-faint)]">
              Service indépendant, sans lien avec les fournisseurs cités. Données
              hébergées dans l&apos;Union européenne.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-[13px] sm:grid-cols-3">
            <FooterColumn title="Produit">
              <FooterLink href="/#fonctionnalites">Fonctionnalités</FooterLink>
              <FooterLink href="/#tarifs">Tarifs</FooterLink>
              <FooterLink href="/#faq">Questions</FooterLink>
            </FooterColumn>
            <FooterColumn title="Ressources">
              <FooterLink href="/resilier">Guides de résiliation</FooterLink>
              <FooterLink href="/login">Connexion</FooterLink>
            </FooterColumn>
            <FooterColumn title="Légal">
              {LEGAL_PAGES.map((page) => (
                <FooterLink key={page.href} href={page.href}>
                  {page.label}
                </FooterLink>
              ))}
            </FooterColumn>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1160px] flex-wrap justify-between gap-2 border-t border-[var(--border-soft)] px-5 py-5 font-mono text-[11px] tracking-[0.04em] text-[var(--text-ghost)]">
          <span>© 2026 AdminPilot</span>
          <span>Fait en France</span>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="mb-1 font-mono text-[11px] tracking-[0.08em] text-[var(--text-ghost)] uppercase">
        {title}
      </div>
      {children}
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-[var(--text-dim)] transition-colors hover:text-[var(--text-bright)]"
    >
      {children}
    </Link>
  );
}
