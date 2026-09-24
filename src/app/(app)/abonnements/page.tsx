import Link from "next/link";

import { SubscriptionList } from "@/components/dashboard/subscription-list";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Abonnements — AdminPilot" };

/**
 * Liste des abonnements, avec un mode « revue » pour les extractions douteuses.
 *
 * La revue n'est pas un détail d'interface : c'est ce qui transforme une
 * supposition de la machine en donnée fiable. Sans elle, les erreurs
 * d'extraction resteraient éternellement en base.
 */
export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ revue?: string }>;
}) {
  const { revue } = await searchParams;
  const reviewMode = revue === "1";

  const supabase = await createClient();

  let query = supabase
    .from("subscriptions")
    .select("*")
    .order("amount", { ascending: false, nullsFirst: false });

  query = reviewMode
    ? query.eq("confirmed_by_user", false).lt("confidence", 0.7)
    : query.eq("status", "active");

  const { data } = await query;

  return (
    <div className="flex flex-col gap-5">
      <header className="anim-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[26px] font-bold tracking-[-0.03em]">
            {reviewMode ? "À vérifier" : "Abonnements"}
          </h1>
          <p className="m-0 mt-1 max-w-xl text-sm text-[var(--text-dim)]">
            {reviewMode
              ? "Ces montants ont été extraits avec une confiance faible. Corrige ou confirme — tant que tu ne l’as pas fait, ils ne déclenchent aucune alerte."
              : "Détectés depuis les emails que tu transfères."}
          </p>
        </div>

        <Link
          href={reviewMode ? "/abonnements" : "/abonnements?revue=1"}
          className="rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3.5 py-2 text-sm text-[var(--text-muted)] no-underline transition-colors hover:bg-[rgba(255,255,255,.06)] hover:text-white"
        >
          {reviewMode ? "Voir tous les abonnements" : "Voir ceux à vérifier"}
        </Link>
      </header>

      <SubscriptionList initial={data ?? []} reviewMode={reviewMode} />
    </div>
  );
}
