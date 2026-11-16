import type { Metadata } from "next";
import Link from "next/link";

import { LogoMark } from "@/components/marketing/logo-mark";

/**
 * Page introuvable. Sans elle, Next.js affichait sa page par défaut, en
 * anglais (« This page could not be found. »), sans lien pour repartir.
 */
export const metadata: Metadata = { title: "Page introuvable — AdminPilot" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg)] px-5 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <Link href="/" aria-label="Accueil AdminPilot">
          <LogoMark />
        </Link>
        <p className="mono m-0 text-sm text-[var(--text-faint)]">Erreur 404</p>
        <h1 className="serif m-0 text-[36px] leading-[1.05]">Page introuvable.</h1>
        <p className="m-0 text-sm text-[var(--text-dim)]">
          Le lien est peut-être incomplet, ou la page a changé d’adresse.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary h-11 px-5 text-sm">
            Retour à l’accueil
          </Link>
          <Link href="/dashboard" className="btn-secondary h-11 px-5 text-sm">
            Mon espace
          </Link>
        </div>
      </div>
    </main>
  );
}
