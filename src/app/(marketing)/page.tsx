import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Faq } from "@/components/marketing/faq";
import { ScanDemo, SearchDemo } from "@/components/marketing/feature-demos";
import { HeroMockup } from "@/components/marketing/hero-mockup";
import { Pricing } from "@/components/marketing/pricing";

/**
 * Page d'accueil.
 *
 * Composition éditoriale plutôt que « landing page » : titre aligné à gauche
 * en caractères à empattements, sections numérotées comme les articles d'un
 * document, fonctionnalités présentées en liste plutôt qu'en grille de cartes à
 * icône colorée. Ce sont de petits écarts, mais ce sont précisément ceux qui
 * séparent une page composée d'une page générée.
 */
export default function LandingPage() {
  return (
    <main>
      {/* ------------------------------------------------------- accroche */}
      <section id="top" className="mx-auto max-w-[1160px] px-5 pt-16 pb-12 sm:pt-24">
        <p className="anim-up m-0 font-mono text-xs tracking-[0.06em] text-[var(--text-faint)] uppercase">
          Reconduction tacite · Loi Chatel · Loi Hamon
        </p>

        <h1 className="serif anim-up mt-6 mb-0 max-w-[1000px] text-[clamp(46px,8.4vw,100px)] leading-[0.96] text-balance text-[var(--text-bright)]">
          Reprends la main sur tes abonnements <em>et tes factures.</em>
        </h1>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,540px)_1fr] lg:items-end lg:gap-16">
          <p className="m-0 text-lg leading-[1.6] text-pretty text-[var(--text-dim)]">
            Tu transfères tes factures, AdminPilot en extrait les abonnements,
            classe tes documents et te prévient avant chaque reconduction
            tacite. Il ne se connecte jamais à ta boîte mail.
          </p>

          <div className="flex flex-wrap items-center gap-x-7 gap-y-4 lg:justify-end">
            <Link href="/login" className="btn-primary h-12 px-6 text-[15px]">
              Commencer gratuitement
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/#fonctionnalites" className="btn-link text-[15px]">
              Voir comment ça marche
            </Link>
          </div>
        </div>

        <p className="mt-9 mb-0 font-mono text-xs text-[var(--text-faint)]">
          Gratuit jusqu&apos;à 5 abonnements
          <Sep />
          Sans carte bancaire
          <Sep />
          Emails bruts supprimés sous 30 jours
        </p>

        <HeroMockup />
      </section>

      {/* --------------------------------------------- fonctionnalités */}
      <section
        id="fonctionnalites"
        className="mx-auto max-w-[1160px] scroll-mt-20 px-5 pt-28 pb-10"
      >
        <div className="section-mark">§ 01 — Ce que fait AdminPilot</div>
        <h2 className="serif mt-6 mb-0 max-w-[760px] text-[clamp(36px,5.2vw,60px)] leading-[1.02] text-balance">
          Ta vie administrative, <em>en pilote automatique.</em>
        </h2>

        <div className="mt-14 border-t border-[var(--border)]">
          <Feature
            index="01"
            title="Détection automatique"
            body="Transfère une facture : fournisseur, montant, périodicité et prochaine échéance sont extraits en quelques secondes. Ce qui est incertain est marqué « à vérifier », jamais présenté comme acquis."
          >
            <ScanDemo />
          </Feature>

          <Feature
            index="02"
            title="Alertes avant reconduction"
            body="Une alerte sept jours avant, une autre la veille. Le temps de décider si tu gardes — pas de constater le prélèvement."
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs text-[var(--text-faint)]">
                  MAIF · Assurance habitation
                </div>
                <div className="mt-1 text-sm">Reconduction tacite dans</div>
              </div>
              <div className="mono flex items-baseline gap-4 text-[var(--warning-light)]">
                {[
                  ["06", "j"],
                  ["23", "h"],
                  ["59", "min"],
                ].map(([value, unit]) => (
                  <span key={unit} className="flex items-baseline gap-1">
                    <span className="text-[28px] font-semibold tracking-[-0.02em]">
                      {value}
                    </span>
                    <span className="text-xs text-[var(--text-faint)]">
                      {unit}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </Feature>

          <Feature
            index="03"
            title="Coffre-fort documentaire"
            body="Dépose un PDF ou une photo : il est classé, renommé, et retrouvable en langage courant. « La facture EDF de mars » suffit."
          >
            <SearchDemo />
          </Feature>

          <Feature
            index="04"
            title="Lettres de résiliation"
            body="Loi Hamon, loi Chatel, résiliation infra-annuelle : la base légale est citée mot pour mot, la lettre est prête à envoyer en recommandé."
          >
            <div className="mono text-[12px] leading-[1.75] text-[var(--text-faint)]">
              <div className="text-[var(--text)]">
                Objet : résiliation du contrat n° 48‑2291
              </div>
              <div>Madame, Monsieur,</div>
              <div>
                Conformément à l&apos;article L113‑15‑2 du Code des
                assurances…
              </div>
            </div>
          </Feature>
        </div>
      </section>

      {/* ------------------------------------------------------- tarifs */}
      <section
        id="tarifs"
        className="mx-auto max-w-[1160px] scroll-mt-20 px-5 pt-28 pb-10"
      >
        <div className="section-mark">§ 02 — Tarifs</div>
        <h2 className="serif mt-6 mb-12 max-w-[720px] text-[clamp(36px,5.2vw,60px)] leading-[1.02] text-balance">
          Rentabilisé dès le <em>premier abonnement oublié.</em>
        </h2>

        <Pricing />

        <aside className="mt-12 grid gap-3 border-l-2 border-[var(--positive)] py-1 pl-5 sm:grid-cols-[200px_1fr] sm:gap-8">
          <div className="font-mono text-xs tracking-[0.06em] text-[var(--positive-light)] uppercase">
            Ce qu&apos;on lit,
            <br />
            ce qu&apos;on garde
          </div>
          <p className="m-0 max-w-[680px] text-sm leading-[1.7] text-pretty text-[var(--text-dim)]">
            AdminPilot ne se connecte jamais à ta boîte mail : il ne voit que les
            emails que tu lui transfères. Les messages bruts sont supprimés
            trente jours après analyse, seules les données extraites sont
            conservées, et rien ne sert à entraîner un modèle.{" "}
            <Link href="/legal/confidentialite" className="btn-link text-sm">
              Le détail
            </Link>
          </p>
        </aside>
      </section>

      {/* ---------------------------------------------------------- FAQ */}
      <section
        id="faq"
        className="mx-auto max-w-[1160px] scroll-mt-20 px-5 pt-28 pb-10"
      >
        <div className="section-mark">§ 03 — Questions</div>
        <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <h2 className="serif m-0 text-[clamp(36px,5.2vw,60px)] leading-[1.02] text-balance">
            Ce qu&apos;on nous <em>demande souvent.</em>
          </h2>
          <Faq />
        </div>
      </section>

      {/* --------------------------------------------------- appel final */}
      <section className="mx-auto max-w-[1160px] px-5 pt-24 pb-28">
        <div className="grid gap-10 border-t border-[var(--border)] pt-14 lg:grid-cols-[1fr_auto] lg:items-end">
          <h2 className="serif m-0 max-w-[820px] text-[clamp(38px,6vw,76px)] leading-[0.98] text-balance">
            La prochaine reconduction, <em>c&apos;est toi qui décides.</em>
          </h2>
          <Link
            href="/login"
            className="btn-primary h-12 self-start px-6 text-[15px] lg:self-end"
          >
            Commencer gratuitement
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

/** Séparateur typographique des mentions en ligne. */
function Sep() {
  return (
    <span aria-hidden className="mx-2.5 text-[var(--text-ghost)]">
      ·
    </span>
  );
}

/**
 * Une fonctionnalité : numéro, texte, démonstration.
 *
 * En ligne et séparée d'un filet, comme une entrée de sommaire. Plus d'icône
 * dans un carré coloré ni de lueur dans l'angle : le numéro suffit à rythmer,
 * et la démonstration montre mieux qu'un pictogramme.
 */
function Feature({
  index,
  title,
  body,
  children,
}: {
  index: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <article className="grid gap-6 border-b border-[var(--border)] py-10 lg:grid-cols-[72px_minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 lg:py-12">
      <span className="font-mono text-sm text-[var(--accent-light)]">
        {index}
      </span>
      <div>
        <h3 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">
          {title}
        </h3>
        <p className="mt-3 mb-0 max-w-[460px] text-[15px] leading-[1.65] text-pretty text-[var(--text-dim)]">
          {body}
        </p>
      </div>
      <div className="self-start rounded-[10px] border border-[var(--border)] bg-[#0d0d13] p-4">
        {children}
      </div>
    </article>
  );
}
