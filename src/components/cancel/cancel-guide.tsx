import { Lightbulb } from "lucide-react";

import { CATEGORY_TIPS, type CancelGuide } from "@/lib/cancel/guides";

/**
 * Affichage des guides de résiliation, commun à l'espace client et aux pages
 * publiques /resilier/[fournisseur].
 */

export function GuideSteps({ guide }: { guide: CancelGuide }) {
  return (
    <div className="flex flex-col gap-2.5">
      <ol className="m-0 list-decimal space-y-1.5 pl-5 text-sm leading-[1.6] text-[var(--text-dim)] marker:font-mono marker:text-[12px] marker:text-[var(--accent-light)]">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {guide.note && (
        <p className="m-0 text-[13px] leading-[1.6] text-[var(--text-dim)]">{guide.note}</p>
      )}
      <p className="m-0 text-xs text-[var(--text-faint)]">
        {guide.checkedAt
          ? `Parcours vérifié le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(`${guide.checkedAt}T00:00:00Z`))}. Les menus peuvent avoir changé depuis.`
          : "Parcours indicatif : les sites renomment souvent leurs menus, cherche l’intitulé le plus proche."}
      </p>
    </div>
  );
}

export function CategoryTip({ category }: { category: string | null | undefined }) {
  const tip = category ? CATEGORY_TIPS[category] : undefined;
  if (!tip) return null;
  return (
    <div className="flex gap-3 rounded-[10px] border border-[var(--border)] bg-[rgba(255,255,255,.02)] px-4 py-3.5">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-[var(--warning-light)]" />
      <div>
        <div className="text-sm font-semibold">{tip.title}</div>
        <p className="m-0 mt-0.5 text-[13px] leading-[1.6] text-[var(--text-dim)]">{tip.body}</p>
      </div>
    </div>
  );
}
