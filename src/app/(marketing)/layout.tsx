import Link from "next/link";
import { Send } from "lucide-react";

import { LEGAL_PAGES } from "@/components/marketing/legal-page";
import { SiteHeader } from "@/components/marketing/site-header";

/**
 * Enveloppe des pages publiques.
 *
 * L'en-tête est une barre flottante en verre dépoli, collante au défilement,
 * posée sur un halo violet et une grille — c'est cette superposition qui donne
 * la profondeur de la maquette.
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
    // défilable, et le halo décoratif de 1200 px qui déborde suffisait alors à
    // ce qu'un simple scrollIntoView décale toute la page latéralement. `clip`
    // rogne sans jamais permettre de défilement — et, contrairement à `hidden`,
    // ne casse pas le `position: sticky` de l'en-tête.
    <div className="relative min-h-dvh overflow-x-clip bg-[var(--bg)]">
      <div
        aria-hidden
        className="glow-top pointer-events-none absolute top-[-320px] left-1/2 ml-[-600px] h-[800px] w-[1200px]"
      />
      <div
        aria-hidden
        className="grid-backdrop pointer-events-none absolute inset-0"
      />

      <SiteHeader />

      <div className="relative z-10">{children}</div>

      <footer className="relative z-10 border-t border-[var(--border-soft)]">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-6 px-5 py-9">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[var(--text)] hover:text-[var(--text)]"
          >
            <span className="grid size-6 place-items-center rounded-[7px] bg-gradient-to-br from-[#8b7cf0] to-[#3b2fa8]">
              <Send className="size-3 text-white" />
            </span>
            <span className="font-bold">AdminPilot</span>
          </Link>

          <nav className="flex flex-wrap gap-x-[22px] gap-y-2 text-[13px]">
            <FooterLink href="/resilier">Guides de résiliation</FooterLink>
            {LEGAL_PAGES.map((page) => (
              <FooterLink key={page.href} href={page.href}>
                {page.label}
              </FooterLink>
            ))}
          </nav>

          <p className="m-0 w-full text-xs text-[var(--text-ghost)]">
            AdminPilot — service indépendant, sans lien avec les fournisseurs
            cités.
          </p>
        </div>
      </footer>
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
      className="text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
    >
      {children}
    </Link>
  );
}
