import Link from "next/link";
import { Forward, Inbox, Lock, Mail, Palette, ShieldCheck, Sparkles, UserRound, Users } from "lucide-react";

import { ManageSubscription, PlanPicker } from "@/components/billing/plan-picker";
import {
  HouseholdManager,
  HouseholdMembership,
} from "@/components/household/household-manager";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { RecapToggle } from "@/components/profile/recap-toggle";
import { ThemePicker } from "@/components/profile/theme-picker";
import { AccountActions } from "@/components/shared/account-actions";
import { ForwardingSetup } from "@/components/shared/forwarding-setup";
import { InboxAddress } from "@/components/shared/inbox-address";
import { inboxAddress, requireUser } from "@/lib/auth/require-user";
import { getStripe, planFromPriceId } from "@/lib/billing/stripe";
import {
  FAMILY_SEATS,
  PLAN_LABELS,
  PLAN_LIMITS,
  RAW_RETENTION_DAYS,
} from "@/lib/constants";
import { forwardingDomains } from "@/lib/forwarding-domains";
import { householdOf, INVITE_SLOTS, membershipOf } from "@/lib/household";
import { avatarUrl, avatarUrls } from "@/lib/profile/avatar";
import { effectiveTheme } from "@/lib/profile/theme";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Réglages — AdminPilot" };

type Plan = "pro" | "family";
type Cycle = "monthly" | "yearly";

/** Formule et périodicité réellement facturées, lues chez Stripe. */
async function currentBilling(
  subscriptionId: string,
): Promise<{ plan: Plan; cycle: Cycle } | null> {
  try {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    const price = subscription.items.data[0]?.price;
    const plan = price ? planFromPriceId(price.id) : null;
    if (!price || !plan || plan === "free") return null;
    return { plan, cycle: price.recurring?.interval === "year" ? "yearly" : "monthly" };
  } catch {
    return null;
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ formule?: string; cycle?: string; paiement?: string; resiliation?: string }>;
}) {
  const auth = await requireUser();
  if (!auth) return null;

  const { profile } = auth;
  const limits = PLAN_LIMITS[profile.plan];
  const params = await searchParams;
  const db = createAdminClient();

  // Titulaire d'un abonnement, membre d'un foyer, ou gratuit : trois écrans.
  const subscriber = profile.plan !== "free" && Boolean(profile.stripe_sub_id);
  const membership = subscriber ? null : await membershipOf(db, auth.userId);
  const isMember = Boolean(membership) && profile.plan === "family";
  const householdOwner = subscriber && profile.plan === "family";

  const [billing, ownAvatar, household, domains] = await Promise.all([
    subscriber && profile.stripe_sub_id ? currentBilling(profile.stripe_sub_id) : null,
    avatarUrl(profile.avatar_path),
    householdOwner ? householdOf(db, auth.userId) : Promise.resolve([]),
    forwardingDomains(),
  ]);
  const memberAvatars = await avatarUrls(household.map((row) => row.member?.avatar_path ?? null));

  // Valeurs venues de l'URL, donc de n'importe qui : réduites à ce qui existe.
  const initialPlan: Plan = params.formule === "family" ? "family" : "pro";
  const initialCycle: Cycle = params.cycle === "yearly" ? "yearly" : "monthly";

  const ownerName = profile.name ?? profile.email;
  const joinedCount = household.filter((row) => row.member).length;

  return (
    <div className="flex flex-col gap-4">
      <header className="anim-up mb-1">
        <h1 className="serif m-0 text-[36px] leading-[1.05]">Réglages</h1>
      </header>

      {params.resiliation === "enregistree" && (
        <p
          role="status"
          className="m-0 rounded-[10px] border border-[rgba(63,207,149,.35)] bg-[rgba(63,207,149,.06)] px-5 py-4 text-sm"
        >
          Ta résiliation est enregistrée. Tu gardes ta formule jusqu’à la fin de
          la période déjà payée, puis ton compte repasse en gratuit, sans perdre
          tes données. Une confirmation t’a été envoyée par e-mail.
        </p>
      )}

      <Card icon={<UserRound className="size-4" />} title="Profil">
        <ProfileEditor
          email={profile.email}
          initialName={profile.name}
          avatarUrl={ownAvatar}
        />
      </Card>

      <Card
        icon={<Palette className="size-4" />}
        title="Apparence"
        subtitle="Fond et couleur secondaire de l’application"
      >
        <ThemePicker
          initial={effectiveTheme(profile)}
          paid={profile.plan !== "free"}
        />
      </Card>

      <Card
        icon={<Inbox className="size-4" />}
        title="Ton adresse d’ingestion"
        subtitle="C’est ici que tu transfères tes factures"
      >
        <InboxAddress address={inboxAddress(profile)} />
        <p className="m-0 mt-3 text-xs text-[var(--text-faint)]">
          Garde-la pour toi : quiconque la connaît peut y envoyer des documents
          qui apparaîtront dans ton compte.
        </p>
      </Card>

      <Card
        icon={<Forward className="size-4" />}
        title="Transfert automatique"
        subtitle="Pour que chaque nouvelle facture arrive sans y penser"
      >
        <ForwardingSetup address={inboxAddress(profile)} domains={domains} />
      </Card>

      <Card
        icon={<Sparkles className="size-4" />}
        title={`Formule ${PLAN_LABELS[profile.plan]}`}
        subtitle={isMember ? "Incluse dans un foyer Premium" : undefined}
      >
        <ul className="m-0 list-none space-y-0 p-0 text-sm">
          <Limit label="Abonnements suivis" value={limits.subscriptions} />
          <Limit label="Documents" value={limits.documents} />
          <Limit label="Alertes par mois" value={limits.alerts} />
          <Limit label="Recherches par mois" value={limits.searches} />
          <Limit label="Résiliations par mois" value={limits.cancellations} />
        </ul>

        {subscriber && (
          <div className="mt-5">
            <ManageSubscription />
          </div>
        )}
      </Card>

      {!isMember && (
        <section id="formules" className="scroll-mt-6">
          <Card
            icon={<Sparkles className="size-4" />}
            title={subscriber ? "Changer de formule" : "Passer à une formule payante"}
            subtitle={
              subscriber
                ? "Pro pour toi seul, Premium pour toi et tes proches"
                : "Recherche en langage courant, lettres de résiliation, tout illimité"
            }
          >
            <PlanPicker
              mode={subscriber ? "switch" : "checkout"}
              initialPlan={billing?.plan ?? initialPlan}
              initialCycle={billing?.cycle ?? initialCycle}
              current={billing ?? undefined}
              cancelled={params.paiement === "annule"}
              householdSize={joinedCount}
            />
          </Card>
        </section>
      )}

      <Card
        icon={<Users className="size-4" />}
        title="Foyer"
        subtitle={
          householdOwner
            ? `Jusqu’à ${FAMILY_SEATS} comptes, chacun avec ses propres données`
            : undefined
        }
      >
        {householdOwner ? (
          <HouseholdManager
            ownerName={ownerName}
            ownerAvatarUrl={ownAvatar}
            slots={INVITE_SLOTS}
            rows={household.map((row) => ({
              id: row.id,
              email: row.email,
              name: row.member?.name ?? row.name,
              joined: Boolean(row.member),
              expired:
                !row.member &&
                Boolean(row.expires_at && new Date(row.expires_at) < new Date()),
              avatarUrl: row.member?.avatar_path
                ? (memberAvatars.get(row.member.avatar_path) ?? null)
                : null,
            }))}
          />
        ) : isMember && membership ? (
          <HouseholdMembership
            ownerName={membership.owner?.name ?? membership.owner?.email ?? "ton foyer"}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <Lock className="size-5 shrink-0 text-[var(--accent-lighter)]" />
            <p className="m-0 min-w-[220px] flex-1 text-sm text-[var(--text-dim)]">
              Avec <strong className="text-[var(--text)]">Premium</strong>,
              invite jusqu’à {INVITE_SLOTS} proches : chacun a son compte, ses
              alertes et ses documents, pour le prix d’un seul abonnement.
            </p>
            <Link
              href="/reglages?formule=family#formules"
              className="btn-secondary h-10 px-4 text-[13px]"
            >
              Découvrir Premium
            </Link>
          </div>
        )}
      </Card>

      <section id="recap" className="scroll-mt-6">
        <Card icon={<Mail className="size-4" />} title="Récap mensuel par e-mail">
          {profile.plan === "free" ? (
            <p className="m-0 flex items-center gap-2 text-sm text-[var(--text-dim)]">
              <Lock className="size-4 shrink-0 text-[var(--accent-lighter)]" />
              Chaque mois, le bilan de tes abonnements et des hausses de prix :
              inclus avec Pro et Premium.
            </p>
          ) : (
            <RecapToggle initial={profile.monthly_recap} />
          )}
        </Card>
      </section>

      <Card
        icon={<ShieldCheck className="size-4 text-[var(--positive)]" />}
        title="Confidentialité"
      >
        <p className="m-0 text-sm text-[var(--text-dim)]">
          Les emails bruts que tu transfères sont supprimés{" "}
          {RAW_RETENTION_DAYS} jours après leur analyse. Seules les données
          extraites — fournisseur, montant, échéance — sont conservées. Rien
          n’est utilisé pour entraîner un modèle.{" "}
          <Link href="/legal/confidentialite">Le détail</Link>.
        </p>
      </Card>

      <AccountActions email={profile.email} />
    </div>
  );
}

function Card({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-sheen anim-up rounded-[var(--radius-xl)] border border-[var(--border)] p-5">
      <div className="mb-3.5">
        <h2 className="m-0 flex items-center gap-2 text-[15px] font-semibold">
          {icon && <span className="text-[var(--accent-light)]">{icon}</span>}
          {title}
        </h2>
        {subtitle && (
          <p className="m-0 mt-0.5 text-xs text-[var(--text-faint)]">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Limit({ label, value }: { label: string; value: number | null }) {
  return (
    <li className="flex justify-between border-b border-[var(--border-soft)] py-2 last:border-b-0">
      <span className="text-[var(--text-dim)]">{label}</span>
      <span className="mono font-medium">
        {value === null ? (
          <span className="text-[var(--positive-light)]">illimité</span>
        ) : value === 0 ? (
          // « 0 recherche par mois » se lit comme une panne ; c'est une
          // fonction réservée aux formules payantes, autant le dire.
          <span className="inline-flex items-center gap-1.5 text-[var(--text-faint)]">
            <Lock className="size-3" />
            avec Pro
          </span>
        ) : (
          value
        )}
      </span>
    </li>
  );
}
