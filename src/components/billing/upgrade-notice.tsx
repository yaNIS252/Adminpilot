import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";

/**
 * Encart affiché quand une limite de la formule gratuite retient quelque
 * chose : abonnements détectés mais masqués, document refusé, recherche ou
 * lettre réservée.
 *
 * Il dit précisément ce qui est retenu, jamais un vague « passez Premium » :
 * c'est la valeur concrète déjà trouvée qui donne envie de payer, pas une liste
 * d'avantages abstraits.
 */
export function UpgradeNotice({
  title,
  body,
  cta = "Passer Pro",
}: {
  title: string;
  body: string;
  cta?: string;
}) {
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-[10px] border border-[rgb(var(--accent-rgb)/.4)] bg-[var(--accent-soft)] px-5 py-4">
      <Lock className="size-5 shrink-0 text-[var(--accent-lighter)]" />
      <div className="min-w-[240px] flex-1">
        <div className="text-[15px] font-semibold">{title}</div>
        <p className="m-0 mt-0.5 text-[13px] leading-[1.5] text-pretty text-[var(--text-dim)]">
          {body}
        </p>
      </div>
      <Link
        href="/reglages?formule=pro#formules"
        className="btn-primary h-10 px-4 text-[13px]"
      >
        {cta}
        <ArrowRight className="size-4" />
      </Link>
    </section>
  );
}

/** Formulation commune pour les abonnements détectés au-delà du quota. */
export function hiddenSubscriptionsCopy(count: number) {
  const plural = count > 1;
  return {
    title: `${count} autre${plural ? "s" : ""} abonnement${plural ? "s" : ""} détecté${plural ? "s" : ""}`,
    body: `La formule gratuite suit 5 abonnements. ${plural ? "Ils sont déjà analysés" : "Il est déjà analysé"} : passe Pro pour ${plural ? "les" : "le"} voir, ${plural ? "les" : "le"} compter dans ton total et être prévenu avant ${plural ? "leurs" : "sa"} reconduction.`,
  };
}
