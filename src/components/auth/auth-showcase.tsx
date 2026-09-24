import { Check, ShieldCheck } from "lucide-react";

/**
 * Panneau d'illustration à droite de la connexion.
 *
 * La maquette plaçait ici un témoignage signé « Camille L. · utilisatrice PRO ».
 * Il n'existe aucune utilisatrice de ce nom : publier un avis inventé sur un
 * produit financier serait une pratique commerciale trompeuse au sens de
 * l'article L121-2 du Code de la consommation, et la première chose qu'un
 * visiteur attentif remarquerait. La composition est conservée, le témoignage
 * est remplacé par ce que le service fait réellement.
 *
 * Les cartes restent des illustrations : montants ronds, fournisseurs connus,
 * aucune donnée réelle — et elles ne sont pas présentées comme telles.
 */
export function AuthShowcase() {
  return (
    <aside className="relative m-3 hidden min-h-[560px] flex-col justify-between gap-8 overflow-hidden rounded-[28px] border border-[rgba(255,255,255,.08)] bg-[radial-gradient(700px_500px_at_70%_10%,rgba(139,124,240,.35),transparent_60%),radial-gradient(500px_400px_at_10%_100%,rgba(95,184,240,.16),transparent_60%),#0d0d14] p-[clamp(24px,4vw,48px)] lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[length:44px_44px] [mask-image:radial-gradient(closest-side_at_60%_40%,#000,transparent)]"
      />

      <div
        aria-hidden
        className="relative m-auto flex w-full max-w-[440px] flex-col gap-3.5"
      >
        <div className="rounded-[20px] border border-[rgba(255,255,255,.1)] bg-[rgba(20,20,30,.6)] p-[18px] shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] backdrop-blur-[20px]">
          <div className="flex justify-between text-xs text-[var(--text-dim)]">
            <span>Dépenses mensuelles</span>
            <span className="font-mono text-[#5fe0a8]">−12,50 €</span>
          </div>
          <div className="mt-1 text-[34px] font-bold tracking-[-0.04em] tabular-nums">
            195,18 €
          </div>
          <div className="mt-3 flex h-16 items-end gap-2">
            {[78, 84, 74, 80, 73].map((height, index) => (
              <span
                key={index}
                style={{ height: `${height}%` }}
                className="flex-1 rounded-md bg-[rgba(255,255,255,.08)]"
              />
            ))}
            <span className="h-[64%] flex-1 rounded-md bg-gradient-to-b from-[#c9c1fa] to-[#8b7cf0] shadow-[0_0_18px_rgba(139,124,240,.8)]" />
          </div>
        </div>

        <div className="flex w-[82%] animate-[ap-float_5s_ease-in-out_infinite] items-center gap-3 self-end rounded-2xl border border-[rgba(224,161,56,.35)] bg-[rgba(28,22,14,.75)] px-3.5 py-3 backdrop-blur-[16px]">
          <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-[#e50914] to-[#1a0203] font-bold text-white">
            N
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold">Netflix — reconduction</div>
            <div className="text-xs text-[var(--text-dim)]">17,99 € · 27 sept.</div>
          </div>
          <span className="rounded-full bg-[rgba(240,113,104,.14)] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[var(--danger)]">
            Dans 3 jours
          </span>
        </div>

        <div className="flex w-[74%] animate-[ap-float_6s_ease-in-out_-2s_infinite] items-center gap-3 rounded-2xl border border-[rgba(63,207,149,.3)] bg-[rgba(14,26,22,.75)] px-3.5 py-3 backdrop-blur-[16px]">
          <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-[rgba(63,207,149,.14)] text-[#5fe0a8]">
            <Check className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold">Lettre de résiliation prête</div>
            <div className="text-xs text-[var(--text-dim)]">Basic-Fit · Loi Chatel</div>
          </div>
        </div>
      </div>

      <div className="relative flex max-w-[440px] flex-col gap-3">
        <p className="m-0 text-[22px] leading-[1.35] font-medium tracking-[-0.02em] text-pretty">
          Tu transfères un e-mail. AdminPilot en sort le montant, la
          périodicité et la date de reconduction —{" "}
          <span className="text-[var(--accent-lighter)]">
            et te prévient avant qu’il soit trop tard pour résilier.
          </span>
        </p>
        <div className="flex items-center gap-2.5 text-[13px] text-[var(--text-dim)]">
          <ShieldCheck className="size-4 text-[var(--positive)]" />
          Aucun accès à ta boîte mail. Emails bruts supprimés sous 30 jours.
        </div>
      </div>
    </aside>
  );
}
