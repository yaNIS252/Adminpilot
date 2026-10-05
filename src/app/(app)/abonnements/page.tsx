import Link from "next/link";
import { CircleCheck } from "lucide-react";

import {
  CancelledList,
  type CancelledSubscription,
} from "@/components/dashboard/cancelled-list";
import { formatAmount, isoDaysAgo, monthlyEquivalent } from "@/lib/format";

import {
  SubscriptionList,
  type RecentPriceChange,
} from "@/components/dashboard/subscription-list";
import { AddSubscription } from "@/components/dashboard/add-subscription";
import { inboxAddress, requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import {
  UpgradeNotice,
  hiddenSubscriptionsCopy,
} from "@/components/billing/upgrade-notice";

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

  const auth = await requireUser();
  const supabase = await createClient();

  let query = supabase
    .from("subscriptions")
    .select("*")
    .eq("over_quota", false)
    .order("amount", { ascending: false, nullsFirst: false });

  query = reviewMode
    ? query.eq("confirmed_by_user", false).lt("confidence", 0.7)
    : query.eq("status", "active");

  const [
    { data },
    { count: hiddenCount },
    { data: changes },
    { data: cancelledRows },
  ] = await Promise.all([
    query,
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("over_quota", true),
    // Changements des 90 derniers jours, du plus récent au plus ancien.
    supabase
      .from("price_changes")
      .select("subscription_id, kind, old_amount, new_amount, source, effective_date")
      .gte("created_at", isoDaysAgo(90))
      .order("created_at", { ascending: false }),
    supabase
      .from("subscriptions")
      .select("id, provider, amount, cycle, cancelled_at, metadata")
      .eq("status", "cancelled")
      .order("cancelled_at", { ascending: false, nullsFirst: false })
      .limit(50),
  ]);

  const cancelled: CancelledSubscription[] = (cancelledRows ?? []).map((row) => {
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    return {
      id: row.id,
      provider: row.provider,
      monthly: monthlyEquivalent(row.amount, row.cycle),
      cancelledAt: row.cancelled_at,
      effectiveDate: typeof meta.cancel_effective_date === "string" ? meta.cancel_effective_date : null,
      viaEmail: meta.cancelled_via === "email",
    };
  });
  const monthlySaved = cancelled.reduce((sum, item) => sum + item.monthly, 0);

  // Le premier rencontré par abonnement est le plus récent.
  // Pastille ↑/↓ seulement si elle décrit encore le prix affiché : une
  // facture qui l'a porté à ce montant, ou une hausse annoncée à venir depuis
  // ce montant. Un prix corrigé à la main l'emporte sur la détection.
  const currentAmount = new Map((data ?? []).map((sub) => [sub.id, Number(sub.amount)]));
  const today = new Date().toISOString().slice(0, 10);
  const latestChange: Record<string, RecentPriceChange> = {};
  for (const change of changes ?? []) {
    if (latestChange[change.subscription_id]) continue;
    const amount = currentAmount.get(change.subscription_id);
    const stillTrue =
      change.source === "announcement"
        ? Boolean(change.effective_date && change.effective_date >= today) &&
          Number(change.old_amount) === amount
        : Number(change.new_amount) === amount;
    if (stillTrue) latestChange[change.subscription_id] = change;
  }

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
              : "Détectés depuis les e-mails que tu transfères, ou ajoutés par toi."}
          </p>
        </div>

        <Link
          href={reviewMode ? "/abonnements" : "/abonnements?revue=1"}
          className="rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3.5 py-2 text-sm text-[var(--text-muted)] no-underline transition-colors hover:bg-[rgba(255,255,255,.06)] hover:text-white"
        >
          {reviewMode ? "Voir tous les abonnements" : "Voir ceux à vérifier"}
        </Link>
      </header>

      {!reviewMode && auth && <AddSubscription inboxAddress={inboxAddress(auth.profile)} />}

      {!reviewMode && hiddenCount ? (
        <UpgradeNotice {...hiddenSubscriptionsCopy(hiddenCount)} />
      ) : null}

      <SubscriptionList
        // Remonté quand la liste change (ajout manuel) : l'état local du
        // composant part de `initial`.
        key={(data ?? []).map((sub) => sub.id).join(",")}
        initial={data ?? []}
        reviewMode={reviewMode}
        priceChanges={latestChange}
      />

      {!reviewMode && cancelled.length > 0 && (
        <section className="card-sheen anim-up rounded-[var(--radius-xl)] border border-[var(--border)] p-5">
          <h2 className="mt-0 mb-1 flex items-center gap-2 text-[15px] font-semibold">
            <CircleCheck className="size-4 text-[var(--positive)]" />
            Résiliés
          </h2>
          <p className="m-0 mb-3 text-xs text-[var(--text-faint)]">
            {monthlySaved > 0
              ? `${formatAmount(monthlySaved)} de moins chaque mois, soit ${formatAmount(monthlySaved * 12)} par an.`
              : "Ils ne comptent plus dans tes dépenses."}{" "}
            Si une facture arrive encore après la résiliation, l’abonnement revient
            ici dans le suivi et tu es prévenu.
          </p>
          <CancelledList items={cancelled} />
        </section>
      )}

    </div>
  );
}
