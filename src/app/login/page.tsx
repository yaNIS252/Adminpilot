import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";

import { AuthPanel } from "@/components/auth/auth-panel";
import { AuthShowcase } from "@/components/auth/auth-showcase";

export const metadata: Metadata = {
  title: "Connexion — AdminPilot",
  description:
    "Connecte-toi à AdminPilot ou crée ton compte. Sans mot de passe : lien sécurisé par e-mail ou compte Google.",
  // Une page de connexion n'a aucune raison d'être indexée, et la voir remonter
  // dans les résultats de recherche dilue le référencement de la landing.
  robots: { index: false, follow: true },
};

/**
 * Écran de connexion — reprise de l'export Claude Design.
 *
 * Deux colonnes sur grand écran : le formulaire à gauche, une illustration du
 * produit à droite. L'illustration disparaît sous 1024 px, où elle repousserait
 * le formulaire sous la ligne de flottaison.
 *
 * La maquette mobile proposait un bouton « Se connecter avec Face ID ». Il n'est
 * pas repris : rien dans le produit n'implémente encore les passkeys, et un
 * bouton qui ne fait rien coûte plus cher en confiance qu'il ne rapporte en
 * esthétique. À rouvrir le jour où WebAuthn sera branché.
 */
export default function LoginPage() {
  return (
    <div className="grid min-h-dvh bg-[var(--bg)] lg:grid-cols-2">
      <main className="relative flex flex-col overflow-hidden px-[clamp(20px,5vw,64px)] py-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[200px] -left-[120px] h-[460px] w-[620px] bg-[radial-gradient(closest-side,rgba(110,90,240,.22),transparent)]"
        />

        <header className="relative flex items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[var(--text)] hover:text-[var(--text)]"
          >
            <span className="grid size-8 place-items-center rounded-[9px] bg-gradient-to-br from-[#8b7cf0] via-[#5b4bd6] to-[#3b2fa8] shadow-[0_0_18px_rgba(139,124,240,.45),inset_0_1px_0_rgba(255,255,255,.3)]">
              <Send className="size-[15px] text-white" />
            </span>
            <span className="text-[17px] font-bold tracking-[-0.02em]">
              AdminPilot
            </span>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-1.5 text-[13px] text-[var(--text-dim)] hover:text-[var(--text)]"
          >
            <ArrowLeft className="size-4" />
            Retour au site
          </Link>
        </header>

        <div className="relative flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[380px]">
            <AuthPanel />
          </div>
        </div>

        <footer className="relative flex flex-wrap justify-between gap-2.5 text-xs text-[var(--text-ghost)]">
          {/* La maquette annonçait « Système opérationnel · 100 % RGPD ». Le
              premier prétend afficher un état de service qu'on ne mesure pas,
              le second est une promesse de conformité qu'aucun audit n'appuie.
              Remplacés par un fait vérifiable. */}
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 animate-[ap-dot_2s_infinite] rounded-full bg-[var(--positive)] shadow-[0_0_8px_var(--positive)]" />
            Données hébergées dans l’Union européenne
          </span>
          <span>© 2026 AdminPilot</span>
        </footer>
      </main>

      <AuthShowcase />
    </div>
  );
}
