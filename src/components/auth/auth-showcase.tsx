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
    <aside className="relative hidden min-h-[560px] flex-col justify-between gap-8 overflow-hidden border-l border-[var(--border-soft)] bg-[#0d0d13] p-[clamp(24px,4vw,56px)] lg:flex">

      <div
        aria-hidden
        className="relative m-auto flex w-full max-w-[440px] flex-col gap-3.5"
      >
        <div className="rounded-[12px] border border-[var(--border-strong)] bg-[var(--bg)] p-[18px]">
          <div className="flex justify-between text-xs text-[var(--text-dim)]">
            <span>Dépenses mensuelles</span>
            <span className="font-mono text-[#5fe0a8]">−12,50 €</span>
          </div>
          <div className="serif mt-1 text-[44px] leading-none tabular-nums">
            195,18 €
          </div>
          <div className="mt-3 flex h-16 items-end gap-2">
            {[78, 84, 74, 80, 73].map((height, index) => (
              <span
                key={index}
                style={{ height: `${height}%` }}
                className="flex-1 rounded-[3px] bg-[rgba(255,255,255,.08)]"
              />
            ))}
            <span className="h-[64%] flex-1 rounded-[3px] bg-[var(--accent)]" />
          </div>
        </div>

        <div className="flex w-[82%] items-center gap-3 self-end rounded-[10px] border border-[rgba(224,161,56,.35)] bg-[#17140e] px-3.5 py-3">
          <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-[#e50914] font-bold text-white">
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

        <div className="flex w-[74%] items-center gap-3 rounded-[10px] border border-[rgba(63,207,149,.3)] bg-[#0e1714] px-3.5 py-3">
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
        <p className="serif m-0 text-[30px] leading-[1.15] text-pretty">
          Tu transfères un e-mail. AdminPilot en sort le montant, la
          périodicité et la date de reconduction —{" "}
          <em>et te prévient avant qu’il soit trop tard pour résilier.</em>
        </p>
        <div className="flex items-center gap-2.5 text-[13px] text-[var(--text-dim)]">
          <ShieldCheck className="size-4 text-[var(--positive)]" />
          Aucun accès à ta boîte mail. Emails bruts supprimés sous 30 jours.
        </div>
      </div>
    </aside>
  );
}
