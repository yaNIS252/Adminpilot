import { cookies } from "next/headers";
import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  ChartPie,
  FileText,
  Layers,
  ScanEye,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import {
  UpgradeNotice,
  hiddenSubscriptionsCopy,
} from "@/components/billing/upgrade-notice";
import { UpsellBanner } from "@/components/billing/upsell-banner";
import { ShareCard } from "@/components/referral/share-card";

import { ProviderAvatar } from "@/components/shared/provider-avatar";
import { requireUser } from "@/lib/auth/require-user";
import { PLAN_LABELS, SHARE_COOKIE, UPSELL_COOKIE } from "@/lib/constants";
import { OWN_SUBSCRIPTION_SOURCE } from "@/lib/billing/sync";
import { periodsPerYear } from "@/lib/ingest/price-tracker";
import {
  daysUntil,
  formatAmount,
  formatCycle,
  formatDate,
  isoDaysAgo,
  formatRelativeDeadline,
  monthlyEquivalent,
} from "@/lib/format";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Vue d'ensemble — AdminPilot" };

const CATEGORY_LABELS: Record<string, string> = {
  streaming: "Streaming",
  energie: "Énergie",
  telecom: "Télécom",
  assurance: "Assurance",
  banque: "Banque",
  transport: "Transport",
  logement: "Logement",
  sante: "Santé",
  logiciel: "Logiciels",
  presse: "Presse",
  sport: "Sport",
  autre: "Autre",
  facture: "Facture",
  contrat: "Contrat",
  impots: "Impôts",
  vehicule: "Véhicule",
  identite: "Identité",
  travail: "Travail",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ abonnement?: string; foyer?: string }>;
}) {
  const auth = await requireUser();
  const { abonnement, foyer } = await searchParams;
  const justPaid = abonnement === "actif";
  const justJoined = foyer === "rejoint" && auth?.profile.plan === "family";
  const cookieStore = await cookies();
  const upsellHidden = cookieStore.get(UPSELL_COOKIE)?.value === "1";
  const shareHidden = cookieStore.get(SHARE_COOKIE)?.value === "1";
  const supabase = await createClient();

  // `count` vit sur la réponse, pas dans `data` : avec `head: true`, `data`
  // est toujours null.
  const [
    { data: subscriptions },
    { data: documents },
    { count: reviewCount },
    { count: hiddenCount },
    { data: priceChanges },
  ] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("*")
        .eq("status", "active")
        .eq("over_quota", false)
        .order("amount", { ascending: false, nullsFirst: false }),
      supabase
        .from("documents")
        .select("id, filename_ai, filename_original, category, deadline")
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("over_quota", false)
        .eq("confirmed_by_user", false)
        .lt("confidence", 0.7),
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("over_quota", true),
      // Douze derniers mois : c'est l'horizon du « combien de plus cette année ».
      supabase
        .from("price_changes")
        .select("id, old_amount, new_amount, cycle, kind, source, effective_date, created_at, subscription_id, subscriptions!inner(provider, over_quota)")
        .eq("subscriptions.over_quota", false)
        .gte("created_at", isoDaysAgo(365))
        .order("created_at", { ascending: false }),
    ]);

  // Impact annuel de chaque changement, puis bilan des hausses et des baisses.
  const changes = (priceChanges ?? []).map((change) => ({
    ...change,
    provider: (change.subscriptions as unknown as { provider: string }).provider,
    yearly: (change.new_amount - change.old_amount) * periodsPerYear(change.cycle),
  }));
  const yearlyIncrease = changes
    .filter((change) => change.kind === "increase")
    .reduce((sum, change) => sum + change.yearly, 0);
  const yearlyDecrease = changes
    .filter((change) => change.kind === "decrease")
    .reduce((sum, change) => sum + change.yearly, 0);

  const subs = subscriptions ?? [];

  // Les cycles sont ramenés au mois : additionner 384 €/an et 13,49 €/mois tels
  // quels donnerait un total qui ne veut rien dire.
  const monthlyTotal = subs.reduce(
    (sum, sub) => sum + monthlyEquivalent(sub.amount, sub.cycle),
    0,
  );

  // Montant de la carte de parrainage : les abonnements détectés, sans la
  // ligne AdminPilot, qui n'a rien à faire dans « et tes proches ? ».
  const detectedMonthly = subs
    .filter(
      (sub) =>
        (sub.metadata as { source?: string } | null)?.source !== OWN_SUBSCRIPTION_SOURCE,
    )
    .reduce((sum, sub) => sum + monthlyEquivalent(sub.amount, sub.cycle), 0);

  // Répartition par catégorie — calculée sur les données du moment, donc juste.
  // La maquette montrait une courbe d'évolution : elle demanderait un
  // historique mensuel qu'on ne conserve pas encore, et l'inventer sur un
  // produit qui parle d'argent serait le plus sûr moyen de perdre la confiance.
  const byCategory = [
    ...subs
      .reduce((map, sub) => {
        const key = sub.category ?? "autre";
        map.set(key, (map.get(key) ?? 0) + monthlyEquivalent(sub.amount, sub.cycle));
        return map;
      }, new Map<string, number>())
      .entries(),
  ]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);

  const upcoming = subs
    .filter((sub) => sub.next_renewal)
    .sort((a, b) => a.next_renewal!.localeCompare(b.next_renewal!))
    .slice(0, 5);

  const today = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-5">
      <header className="anim-up">
        <div className="text-[13px] text-[var(--text-faint)] first-letter:uppercase">
          {today}
        </div>
        <h1 className="serif mt-1 mb-0 text-[36px] leading-[1.05]">
          Bonjour
          {auth?.profile.name ? (
            <em>{` ${auth.profile.name.split(" ")[0]}.`}</em>
          ) : (
            "."
          )}
        </h1>
      </header>

      {/* Retour de paiement. Le webhook Stripe, seul juge du plan, arrive en
          général avant l'utilisateur — mais pas toujours : si le profil est
          encore en gratuit, on le dit plutôt que de laisser croire à un échec. */}
      {justPaid && (
        <section
          role="status"
          className="rounded-[10px] border border-[rgba(63,207,149,.35)] bg-[rgba(63,207,149,.06)] px-5 py-4"
        >
          <div className="text-[15px] font-semibold">
            {auth?.profile.plan && auth.profile.plan !== "free"
              ? `Bienvenue en ${PLAN_LABELS[auth.profile.plan]}.`
              : "Paiement reçu, activation en cours."}
          </div>
          <p className="m-0 mt-0.5 text-[13px] text-[var(--text-dim)]">
            {auth?.profile.plan && auth.profile.plan !== "free"
              ? "Tout est débloqué, y compris les abonnements déjà détectés au-delà de la limite gratuite. Ta facture est disponible dans les réglages."
              : "Ta formule sera active d’ici quelques secondes. Recharge la page si rien ne change."}
          </p>
        </section>
      )}

      {justJoined && (
        <section
          role="status"
          className="rounded-[10px] border border-[rgba(63,207,149,.35)] bg-[rgba(63,207,149,.06)] px-5 py-4"
        >
          <div className="text-[15px] font-semibold">Bienvenue dans le foyer.</div>
          <p className="m-0 mt-0.5 text-[13px] text-[var(--text-dim)]">
            Ton compte profite maintenant de Premium : tout est illimité. Tes
            données restent visibles de toi seul.
          </p>
        </section>
      )}

      {/* Une seule incitation à la fois : si des abonnements sont déjà
          retenus par la limite, c'est cet encart concret qui parle, pas la
          bannière générale. */}
      {auth?.profile.plan === "free" && !hiddenCount && !upsellHidden && (
        <UpsellBanner />
      )}

      {hiddenCount ? (
        <UpgradeNotice {...hiddenSubscriptionsCopy(hiddenCount)} />
      ) : null}

      {reviewCount ? (
        <section
          className="relative flex flex-wrap items-center gap-4 rounded-[10px] border border-[rgba(224,161,56,.35)] bg-[rgba(224,161,56,.05)] px-5 py-[18px]"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius)] border border-[rgba(224,161,56,.35)] bg-[rgba(224,161,56,.16)] text-[var(--warning-bright)]">
            <ScanEye className="size-[19px]" />
          </span>
          <div className="min-w-[280px] flex-1">
            <div className="text-[15px] font-semibold">
              {reviewCount} détection{reviewCount > 1 ? "s" : ""} à vérifier
            </div>
            <div className="mt-0.5 text-[13px] text-pretty text-[var(--text-dim)]">
              Ces montants ont été extraits automatiquement et méritent ton œil
              avant qu&apos;on s&apos;en serve.
            </div>
          </div>
          <Link
            href="/abonnements?revue=1"
            className="btn-primary h-10 px-4 text-[13px]"
          >
            Vérifier maintenant ({reviewCount})
            <ArrowRight className="size-4" />
          </Link>
        </section>
      ) : null}

      <section className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <Stat
          icon={<Wallet className="size-4 text-[var(--accent-light)]" />}
          tint="rgb(var(--accent-rgb) / "
          label="Dépenses mensuelles"
          value={formatAmount(monthlyTotal) ?? "—"}
          footer={
            <span className="text-xs text-[var(--text-faint)]">
              montants annuels ramenés au mois
            </span>
          }
        />
        <Stat
          icon={<CalendarRange className="size-4 text-[#aab3ff]" />}
          tint="rgba(111,124,245,"
          label="Projection annuelle"
          value={formatAmount(monthlyTotal * 12) ?? "—"}
          footer={
            <span className="text-xs text-[var(--text-faint)]">
              au rythme actuel
            </span>
          }
        />
        <Stat
          icon={<Layers className="size-4 text-[var(--positive-light)]" />}
          tint="rgba(63,207,149,"
          label="Abonnements actifs"
          value={String(subs.length)}
          footer={
            reviewCount ? (
              <span className="text-xs text-[var(--warning-light)]">
                dont {reviewCount} à vérifier
              </span>
            ) : (
              <span className="text-xs text-[var(--positive-light)]">
                tous confirmés
              </span>
            )
          }
        />
      </section>

      {/* Partage après la première détection : c'est le chiffre qui donne
          envie d'en parler, pas une publicité. */}
      {auth && detectedMonthly > 0 && !shareHidden && (
        <ShareCard
          link={`${siteUrl()}/p/${auth.profile.referral_code}`}
          monthly={formatAmount(detectedMonthly) ?? ""}
        />
      )}

      {changes.length > 0 && (
        <Card
          title="Évolution des prix"
          subtitle={[
            yearlyIncrease > 0 ? `+${formatAmount(yearlyIncrease)} par an de hausses` : null,
            yearlyDecrease < 0 ? `${formatAmount(yearlyDecrease)} par an de baisses` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          icon={<TrendingUp className="size-4" />}
        >
          <ul className="m-0 mt-3 list-none p-0">
            {changes.slice(0, 5).map((change) => {
              const up = change.kind === "increase";
              const future =
                change.effective_date && change.effective_date > new Date().toISOString().slice(0, 10);
              return (
                <li
                  key={change.id}
                  className="flex flex-wrap items-center gap-3 border-b border-[var(--border-soft)] py-2.5 last:border-b-0"
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full ${
                      up
                        ? "bg-[rgba(224,161,56,.14)] text-[var(--warning-light)]"
                        : "bg-[rgba(63,207,149,.12)] text-[var(--positive-light)]"
                    }`}
                  >
                    {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                  </span>
                  <div className="min-w-[10rem] flex-1">
                    <div className="text-sm font-medium">{change.provider}</div>
                    <div className="text-xs text-[var(--text-faint)]">
                      {future
                        ? `annoncé, à partir du ${formatDate(change.effective_date)}`
                        : `constaté le ${formatDate(change.created_at.slice(0, 10))}`}
                    </div>
                  </div>
                  <span className="mono text-[13px] text-[var(--text-dim)]">
                    {formatAmount(change.old_amount)} → {formatAmount(change.new_amount)}
                  </span>
                  <span
                    className={`mono min-w-[6.5rem] text-right text-[13px] font-semibold ${
                      up ? "text-[var(--warning-light)]" : "text-[var(--positive-light)]"
                    }`}
                  >
                    {up ? "+" : ""}
                    {formatAmount(change.yearly)}/an
                  </span>
                  {up && (
                    <Link
                      href={`/abonnements/${change.subscription_id}/resilier`}
                      className="text-xs"
                    >
                      Résilier
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <section className="flex flex-wrap items-stretch gap-3.5">
        <Card
          className="min-w-0 flex-[1.6_1_420px]"
          title="Répartition des dépenses"
          subtitle="par catégorie, ramenée au mois"
          icon={<ChartPie className="size-4" />}
        >
          {byCategory.length === 0 ? (
            <Empty>Aucun montant connu pour l&apos;instant.</Empty>
          ) : (
            <ul className="m-0 mt-4 list-none space-y-3.5 p-0">
              {byCategory.map(([category, amount]) => (
                <li key={category}>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className="text-[var(--text-soft)]">
                      {CATEGORY_LABELS[category] ?? category}
                    </span>
                    <span className="mono text-[13px] font-semibold">
                      {formatAmount(amount)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,.06)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{
                        width: `${Math.max(3, (amount / monthlyTotal) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          className="min-w-0 flex-[1_1_320px]"
          title="Prochaines échéances"
          subtitle="les cinq plus proches"
          href="/abonnements"
        >
          {upcoming.length === 0 ? (
            <Empty>Aucune échéance connue.</Empty>
          ) : (
            <ul className="m-0 mt-3 list-none space-y-0.5 p-0">
              {upcoming.map((sub) => {
                const days = daysUntil(sub.next_renewal!);
                const uncertain =
                  !sub.confirmed_by_user && sub.confidence < 0.7;

                return (
                  <li
                    key={sub.id}
                    className="flex items-center gap-3 rounded-[var(--radius-sm)] px-2 py-2 transition-colors hover:bg-[rgba(255,255,255,.04)]"
                  >
                    <ProviderAvatar name={sub.provider} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">
                        {sub.provider}
                        {uncertain && (
                          <span
                            title="Détecté automatiquement, non vérifié"
                            className="ml-1.5 text-[var(--warning)]"
                          >
                            ?
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--text-faint)]">
                        {formatCycle(sub.cycle) || "périodicité inconnue"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="mono text-[13px] font-semibold">
                        {formatAmount(sub.amount, sub.currency) ?? "—"}
                      </div>
                      <span
                        className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          days <= 3
                            ? "bg-[rgba(240,113,104,.14)] text-[var(--danger-light)]"
                            : days <= 10
                              ? "bg-[rgba(224,161,56,.14)] text-[var(--warning-light)]"
                              : "bg-[rgba(255,255,255,.05)] text-[var(--text-faint)]"
                        }`}
                      >
                        {formatRelativeDeadline(sub.next_renewal!)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      <Card title="Documents récents" href="/documents">
        {(documents ?? []).length === 0 ? (
          <Empty>Aucun document pour l&apos;instant.</Empty>
        ) : (
          <ul className="m-0 mt-3 list-none space-y-0.5 p-0">
            {(documents ?? []).map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-3 rounded-[var(--radius-sm)] px-2 py-2 transition-colors hover:bg-[rgba(255,255,255,.04)]"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[rgba(111,124,245,.14)] text-[#aab3ff]">
                  <FileText className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {doc.filename_ai ?? doc.filename_original}
                </span>
                {doc.deadline && (
                  <span className="shrink-0 rounded-full bg-[rgba(224,161,56,.14)] px-2 py-0.5 text-[10px] text-[var(--warning-light)]">
                    {formatRelativeDeadline(doc.deadline)}
                  </span>
                )}
                <span className="hidden shrink-0 text-[11px] text-[var(--text-faint)] sm:inline">
                  {CATEGORY_LABELS[doc.category] ?? doc.category}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({
  icon,
  tint,
  label,
  value,
  footer,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
  footer: React.ReactNode;
}) {
  return (
    <div
      className="card-sheen anim-up relative rounded-[var(--radius-xl)] border border-[var(--border)] p-5"
      // La teinte ne colore plus qu'un liseré en tête de carte : de quoi
      // distinguer les trois chiffres d'un coup d'œil, sans la tache
      // lumineuse d'angle qui signait l'ancienne version.
      style={{ borderTopColor: `${tint}.55)` }}
    >
      <div className="flex items-center gap-2 text-[13px] text-[var(--text-dim)]">
        {icon}
        {label}
      </div>
      <div className="mono mt-3 text-[32px] font-semibold tracking-[-0.03em]">
        {value}
      </div>
      <div className="mt-2.5">{footer}</div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  href,
  icon,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`card-sheen anim-up rounded-[var(--radius-xl)] border border-[var(--border)] p-5 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            {icon && <span className="text-[var(--accent-light)]">{icon}</span>}
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-[var(--text-faint)]">{subtitle}</div>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="shrink-0 text-xs text-[var(--text-dim)] hover:text-[var(--accent-light)]"
          >
            Tout voir
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 py-8 text-center text-sm text-[var(--text-faint)]">
      {children}
    </p>
  );
}
