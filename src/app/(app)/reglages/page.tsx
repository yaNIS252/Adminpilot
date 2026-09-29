import Link from "next/link";
import { Inbox, ShieldCheck, Sparkles } from "lucide-react";

import { ManageSubscription, PlanPicker } from "@/components/billing/plan-picker";
import { AccountActions } from "@/components/shared/account-actions";
import { InboxAddress } from "@/components/shared/inbox-address";
import { inboxAddress, requireUser } from "@/lib/auth/require-user";
import { PLAN_LIMITS, RAW_RETENTION_DAYS } from "@/lib/constants";

export const metadata = { title: "Réglages — AdminPilot" };

const PLAN_LABELS = {
  free: "Gratuit",
  pro: "Pro",
  family: "Famille",
} as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ formule?: string; cycle?: string; paiement?: string }>;
}) {
  const auth = await requireUser();
  if (!auth) return null;

  const limits = PLAN_LIMITS[auth.profile.plan];
  const params = await searchParams;

  // Valeurs venues de l'URL, donc de n'importe qui : réduites à ce qui existe.
  const initialPlan = params.formule === "family" ? "family" : "pro";
  const initialCycle = params.cycle === "yearly" ? "yearly" : "monthly";

  return (
    <div className="flex flex-col gap-4">
      <header className="anim-up mb-1">
        <h1 className="serif m-0 text-[36px] leading-[1.05]">
          Réglages
        </h1>
      </header>

      <Card
        icon={<Inbox className="size-4" />}
        title="Ton adresse d’ingestion"
        subtitle="C’est ici que tu transfères tes factures"
      >
        <InboxAddress address={inboxAddress(auth.profile)} />
        <p className="m-0 mt-3 text-xs text-[var(--text-faint)]">
          Garde-la pour toi : quiconque la connaît peut y envoyer des documents
          qui apparaîtront dans ton compte.
        </p>
      </Card>

      <Card
        icon={<Sparkles className="size-4" />}
        title={`Formule ${PLAN_LABELS[auth.profile.plan]}`}
      >
        <ul className="m-0 list-none space-y-0 p-0 text-sm">
          <Limit label="Abonnements suivis" value={limits.subscriptions} />
          <Limit label="Documents" value={limits.documents} />
          <Limit label="Alertes par mois" value={limits.alerts} />
          <Limit label="Recherches par mois" value={limits.searches} />
          <Limit label="Résiliations par mois" value={limits.cancellations} />
        </ul>

        {auth.profile.plan !== "free" && (
          <div className="mt-5">
            <ManageSubscription />
          </div>
        )}
      </Card>

      {auth.profile.plan === "free" && (
        <section id="formules" className="scroll-mt-6">
          <Card
            icon={<Sparkles className="size-4" />}
            title="Passer à une formule payante"
            subtitle="Recherche en langage courant, lettres de résiliation, tout illimité"
          >
            <PlanPicker
              initialPlan={initialPlan}
              initialCycle={initialCycle}
              cancelled={params.paiement === "annule"}
            />
          </Card>
        </section>
      )}

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

      <AccountActions email={auth.profile.email} />
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
          <span className="text-[var(--text-faint)]">non incluse</span>
        ) : (
          value
        )}
      </span>
    </li>
  );
}
