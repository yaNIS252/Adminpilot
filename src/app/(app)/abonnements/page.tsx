import Link from "next/link";
import { FileText } from "lucide-react";

import { SubscriptionList } from "@/components/dashboard/subscription-list";
import { createClient } from "@/lib/supabase/server";
import {
  UpgradeNotice,
  hiddenSubscriptionsCopy,
} from "@/components/billing/upgrade-notice";

export const metadata = { title: "Abonnements — AdminPilot" };

const LETTER_STATUS = {
  draft: "Brouillon",
  generated: "Lettre prête",
  sent: "Envoyée",
  confirmed: "Confirmée",
} as const;

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
    .eq("over_quota", false)
    .order("amount", { ascending: false, nullsFirst: false });

  query = reviewMode
    ? query.eq("confirmed_by_user", false).lt("confidence", 0.7)
    : query.eq("status", "active");

  const [{ data }, { count: hiddenCount }, { data: letters }] = await Promise.all([
    query,
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("over_quota", true),
    supabase
      .from("cancellations")
      .select("id, status, created_at, sent_at, subscription_id, subscriptions(provider)")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <header className="anim-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="serif m-0 text-[36px] leading-[1.05]">
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

      {!reviewMode && hiddenCount ? (
        <UpgradeNotice {...hiddenSubscriptionsCopy(hiddenCount)} />
      ) : null}

      <SubscriptionList initial={data ?? []} reviewMode={reviewMode} />

      {!reviewMode && (letters ?? []).length > 0 && (
        <section className="card-sheen anim-up rounded-[var(--radius-xl)] border border-[var(--border)] p-5">
          <h2 className="mt-0 mb-3 flex items-center gap-2 text-[15px] font-semibold">
            <FileText className="size-4 text-[var(--accent-light)]" />
            Mes résiliations
          </h2>
          <ul className="m-0 list-none p-0">
            {(letters ?? []).map((letter) => {
              const provider =
                (letter.subscriptions as unknown as { provider: string } | null)?.provider ??
                "Abonnement";
              return (
                <li
                  key={letter.id}
                  className="flex flex-wrap items-center gap-3 border-b border-[var(--border-soft)] py-2.5 last:border-b-0"
                >
                  <Link
                    href={`/abonnements/${letter.subscription_id}/resilier`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)] no-underline hover:text-[var(--accent-lighter)]"
                  >
                    {provider}
                  </Link>
                  <span className="text-xs text-[var(--text-faint)]">
                    {LETTER_STATUS[letter.status]}
                    {" · "}
                    {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
                      new Date(letter.sent_at ?? letter.created_at),
                    )}
                  </span>
                  <a
                    href={`/api/cancel/${letter.id}`}
                    target="_blank"
                    rel="noopener"
                    className="text-xs"
                  >
                    PDF
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
