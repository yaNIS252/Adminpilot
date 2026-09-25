import Link from "next/link";
import {
  AlarmClock,
  Archive,
  ArrowRight,
  Check,
  FileSignature,
  Play,
  ScanSearch,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { Faq } from "@/components/marketing/faq";
import { ScanDemo, SearchDemo } from "@/components/marketing/feature-demos";
import { HeroMockup } from "@/components/marketing/hero-mockup";
import { Pricing } from "@/components/marketing/pricing";

export default function LandingPage() {
  return (
    <main>
      {/* ------------------------------------------------------- accroche */}
      <section
        id="top"
        className="relative mx-auto max-w-[1160px] px-5 pt-[72px] pb-10 text-center"
      >
        <span className="anim-pulse inline-flex items-center gap-2 rounded-full border border-[rgba(139,124,240,.35)] bg-[rgba(139,124,240,.1)] py-1.5 pr-3.5 pl-2 text-[13px] text-[#d4cefb]">
          <span className="grid size-5 place-items-center rounded-full bg-gradient-to-br from-[#f5c451] to-[#e0a138]">
            <Zap className="size-[11px] text-[#1a1300]" />
          </span>
          Tes factures, lues et classées automatiquement
        </span>

        <h1 className="anim-up mx-auto mt-[26px] max-w-[900px] text-[clamp(40px,7vw,80px)] leading-[1.02] font-extrabold tracking-[-0.045em] text-balance">
          <span className="text-gradient-white">
            Reprends le contrôle sur tes abonnements{" "}
          </span>
          <span className="text-gradient-accent">et tes factures.</span>
        </h1>

        <p className="mx-auto mt-[22px] max-w-[620px] text-lg leading-[1.6] text-pretty text-[var(--text-dim)]">
          AdminPilot repère tes abonnements dans les emails que tu lui
          transfères, classe tes documents et t&apos;alerte avant chaque
          reconduction tacite. Sans jamais se connecter à ta boîte mail.
        </p>

        <div className="mt-[34px] flex flex-col items-center gap-3.5">
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/login"

              // bouton doit accrocher l'œil avant tout le reste du bloc.
              className="flex items-center gap-2 rounded-[var(--radius-md)] bg-gradient-to-b from-[#7c6ae9] via-[#5744cf] to-[#3a2ca6] px-[26px] py-[15px] text-base font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.45),inset_0_0_0_1px_rgba(255,255,255,.22),0_10px_40px_-10px_rgba(139,124,240,.9)] transition-all hover:-translate-y-0.5 hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,.6),inset_0_0_0_1px_rgba(255,255,255,.32),0_0_60px_-6px_rgba(139,124,240,1)]"
            >
              Commencer gratuitement
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/#fonctionnalites"
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[rgba(255,255,255,.1)] bg-[rgba(255,255,255,.03)] px-[22px] py-[15px] text-base font-medium text-[var(--text-soft)] transition-colors hover:bg-[rgba(255,255,255,.07)] hover:text-white"
            >
              <Play className="size-3.5" />
              Voir comment ça marche
            </Link>
          </div>

          <ul className="m-0 flex list-none flex-wrap justify-center gap-[18px] p-0 text-[13px] text-[var(--text-faint)]">
            {[
              "Gratuit jusqu'à 5 abonnements",
              "Sans carte bancaire",
              "Emails bruts supprimés sous 30 jours",
            ].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="size-4 text-[var(--positive)]" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <HeroMockup />
      </section>

      {/* --------------------------------------------- fonctionnalités */}
      <section
        id="fonctionnalites"
        className="relative mx-auto max-w-[1160px] scroll-mt-24 px-5 pt-[110px] pb-10"
      >
        <div className="mx-auto mb-12 max-w-[640px] text-center">
          <div className="label-caps">Fonctionnalités</div>
          <h2 className="mt-3 mb-0 text-[clamp(30px,4.4vw,46px)] leading-[1.08] font-bold tracking-[-0.035em] text-balance">
            Ta vie admin, en pilote automatique.
          </h2>
          <p className="mt-3.5 mb-0 text-[17px] text-pretty text-[var(--text-dim)]">
            Quatre briques qui travaillent pendant que tu fais autre chose.
          </p>
        </div>

        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr))]">
          <Feature
            icon={<ScanSearch className="size-[19px]" />}
            tint="rgba(111,124,245,"
            iconColor="#aab3ff"
            hoverBorder="hover:border-[rgba(139,124,240,.4)]"
            title="Détection automatique"
            body="Transfère tes factures en un geste : fournisseur, montant, périodicité et prochaine échéance sont extraits en quelques secondes."
          >
            <ScanDemo />
          </Feature>

          <Feature
            icon={<AlarmClock className="size-[19px]" />}
            tint="rgba(224,161,56,"
            iconColor="#f0c070"
            hoverBorder="hover:border-[rgba(224,161,56,.4)]"
            title="Alertes anti-reconduction"
            body="Une alerte sept jours avant, une autre la veille. Le temps de décider si tu gardes — pas de constater le prélèvement."
          >
            <div className="flex flex-wrap items-center gap-3.5">
              <div className="min-w-[140px] flex-1">
                <div className="text-xs text-[var(--text-faint)]">
                  MAIF · Assurance habitation
                </div>
                <div className="mt-0.5 text-[13px]">Reconduction tacite dans</div>
              </div>
              <div className="mono flex gap-1.5">
                {[
                  ["06", "jours"],
                  ["23", "h"],
                  ["59", "min"],
                ].map(([value, unit]) => (
                  <div
                    key={unit}
                    className="min-w-[46px] rounded-[var(--radius-sm)] border border-[rgba(224,161,56,.25)] bg-[rgba(224,161,56,.1)] px-1.5 py-[7px] text-center"
                  >
                    <div className="text-lg font-semibold text-[#f5d08a]">
                      {value}
                    </div>
                    <div className="text-[9px] tracking-[0.08em] text-[#a08650] uppercase">
                      {unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Feature>

          <Feature
            icon={<Archive className="size-[19px]" />}
            tint="rgba(63,207,149,"
            iconColor="#7ee0b5"
            hoverBorder="hover:border-[rgba(63,207,149,.4)]"
            title="Coffre-fort documentaire"
            body="Dépose un PDF ou une photo : il est classé, renommé, et retrouvable en langage courant."
          >
            <SearchDemo />
          </Feature>

          <Feature
            icon={<FileSignature className="size-[19px]" />}
            tint="rgba(240,113,104,"
            iconColor="#f5a09a"
            hoverBorder="hover:border-[rgba(240,113,104,.4)]"
            title="Résiliation en un clic"
            body="Loi Hamon, loi Chatel, infra-annuelle : la bonne base légale est citée, la lettre est prête à envoyer."
          >
            <div className="mono text-[11px] leading-[1.7] text-[var(--text-faint)]">
              <div className="text-[var(--text)]">
                Objet : résiliation du contrat n° 48‑2291
              </div>
              <div>Conformément à l&apos;article L113‑15‑2</div>
              <div>du Code des assurances (loi Hamon)…</div>
            </div>
          </Feature>
        </div>
      </section>

      {/* ------------------------------------------------------- tarifs */}
      <section
        id="tarifs"
        className="relative mx-auto max-w-[1160px] scroll-mt-24 px-5 pt-[110px] pb-10"
      >
        <div className="mx-auto mb-9 max-w-[640px] text-center">
          <div className="label-caps">Tarifs</div>
          <h2 className="mt-3 mb-0 text-[clamp(30px,4.4vw,46px)] leading-[1.08] font-bold tracking-[-0.035em]">
            Rentabilisé dès le premier abonnement oublié.
          </h2>
        </div>

        <Pricing />

        <div className="mt-7 flex items-start gap-4 rounded-[var(--radius-lg)] border border-[rgba(63,207,149,.18)] bg-[rgba(63,207,149,.04)] px-6 py-[22px]">
          <ShieldCheck className="mt-0.5 size-[22px] shrink-0 text-[var(--positive)]" />
          <div>
            <div className="text-[15px] font-semibold">
              Ce qu&apos;on lit, ce qu&apos;on garde
            </div>
            <p className="mt-1 mb-0 text-sm leading-[1.6] text-pretty text-[var(--text-dim)]">
              AdminPilot ne se connecte jamais à ta boîte mail. Il ne voit que
              les emails que tu lui transfères. Les messages bruts sont
              supprimés trente jours après analyse ; seules les données
              extraites sont conservées, et rien ne sert à entraîner un modèle.{" "}
              <Link href="/legal/confidentialite">Le détail</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- FAQ */}
      <section
        id="faq"
        className="relative mx-auto max-w-[760px] scroll-mt-24 px-5 pt-[110px] pb-[60px]"
      >
        <h2 className="mt-0 mb-7 text-center text-[clamp(28px,4vw,40px)] font-bold tracking-[-0.035em]">
          Questions fréquentes
        </h2>
        <Faq />
      </section>

      {/* --------------------------------------------------- appel final */}
      <section className="mx-auto max-w-[1160px] px-5 pt-10 pb-20">
        <div
          className="relative overflow-hidden rounded-[24px] border border-[rgba(139,124,240,.3)] px-7 py-14 text-center"
          style={{
            background:
              "radial-gradient(ellipse 60% 100% at 50% 100%,rgba(139,124,240,.3),transparent),rgba(255,255,255,.02)",
          }}
        >
          <h2 className="m-0 text-[clamp(28px,4vw,42px)] font-bold tracking-[-0.035em] text-balance">
            La prochaine reconduction, c&apos;est toi qui décides.
          </h2>
          <Link
            href="/login"
            className="mt-[26px] inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-gradient-to-b from-[#7c6ae9] via-[#5744cf] to-[#3a2ca6] px-6 py-3.5 font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.45),inset_0_0_0_1px_rgba(255,255,255,.22),0_10px_40px_-10px_rgba(139,124,240,.9)] transition-all hover:-translate-y-0.5 hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,.6),inset_0_0_0_1px_rgba(255,255,255,.32),0_0_60px_-6px_rgba(139,124,240,1)]"
          >
            Commencer gratuitement
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

function Feature({
  icon,
  tint,
  iconColor,
  hoverBorder,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  /** Préfixe rgba, la transparence est ajoutée selon l'usage. */
  tint: string;
  iconColor: string;
  hoverBorder: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`card-sheen relative overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] p-7 transition-all hover:-translate-y-[3px] ${hoverBorder}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 size-[220px]"
        style={{
          background: `radial-gradient(closest-side,${tint}.22),transparent)`,
        }}
      />
      <div
        className="grid size-10 place-items-center rounded-[var(--radius)] border"
        style={{
          background: `${tint}.12)`,
          borderColor: `${tint}.3)`,
          color: iconColor,
        }}
      >
        {icon}
      </div>

      <h3 className="mt-[18px] mb-1.5 text-xl tracking-[-0.02em]">{title}</h3>
      <p className="m-0 text-[15px] leading-[1.6] text-pretty text-[var(--text-dim)]">
        {body}
      </p>

      <div className="mt-[22px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[rgba(10,10,15,.6)] p-3.5">
        {children}
      </div>
    </div>
  );
}
