import Link from "next/link";
import { Bell, BellOff, Lock } from "lucide-react";

import {
  NewReminder,
  ReminderSwitches,
  UpcomingAlerts,
  type Target,
} from "@/components/alerts/alerts-manager";
import { requireUser } from "@/lib/auth/require-user";
import { currentPeriod } from "@/lib/billing/quotas";
import { PLAN_LIMITS } from "@/lib/constants";
import { formatDate, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Alertes — AdminPilot" };

export default async function AlertsPage() {
  const auth = await requireUser();
  const supabase = await createClient();
  const monthlyCap = auth ? PLAN_LIMITS[auth.profile.plan].alerts : null;

  const [
    { data: upcoming },
    { data: sent },
    { data: usage },
    { data: subscriptions },
    { data: documents },
  ] = await Promise.all([
    supabase
      .from("alerts")
      .select("*")
      .is("sent_at", null)
      .order("alert_date", { ascending: true })
      .limit(50),
    supabase
      .from("alerts")
      .select("*")
      .not("sent_at", "is", null)
      .order("alert_date", { ascending: false })
      .limit(20),
    supabase
      .from("usage_counters")
      .select("alerts_count")
      .eq("period", currentPeriod())
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("id, provider, next_renewal, reminders_muted, cycle")
      .eq("status", "active")
      .eq("over_quota", false)
      .order("provider"),
    supabase
      .from("documents")
      .select("id, filename_ai, filename_original")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const targets: Target[] = [
    ...(subscriptions ?? []).map((sub) => ({ id: sub.id, type: "subscription" as const, label: sub.provider })),
    ...(documents ?? []).map((doc) => ({
      id: doc.id,
      type: "document" as const,
      label: doc.filename_ai ?? doc.filename_original,
    })),
  ];

  const sentThisMonth = usage?.alerts_count ?? 0;
  const cycles = new Map((subscriptions ?? []).map((sub) => [sub.id, sub.cycle]));

  return (
    <div className="flex flex-col gap-5">
      <header className="anim-up">
        <h1 className="serif m-0 text-[36px] leading-[1.05]">Alertes</h1>
        <p className="m-0 mt-1 max-w-xl text-sm text-[var(--text-dim)]">
          Créées automatiquement sept jours puis un jour avant chaque échéance
          connue. Une détection non vérifiée n’en déclenche aucune.
        </p>
      </header>

      {monthlyCap !== null && (
        <section className="anim-up flex flex-wrap items-center gap-4 rounded-[var(--radius-xl)] border border-[var(--border)] px-5 py-4">
          <div className="min-w-[200px] flex-1">
            <div className="flex justify-between text-[13px]">
              <span className="text-[var(--text-dim)]">Alertes envoyées ce mois-ci</span>
              <span className="mono">
                {Math.min(sentThisMonth, monthlyCap)} / {monthlyCap}
              </span>
            </div>
            <div className="mt-2 h-[5px] overflow-hidden rounded-[5px] bg-[rgba(255,255,255,.06)]">
              <div
                className={`h-full ${sentThisMonth >= monthlyCap ? "bg-[var(--warning)]" : "bg-[var(--accent)]"}`}
                style={{ width: `${Math.max(3, Math.min(1, sentThisMonth / monthlyCap) * 100)}%` }}
              />
            </div>
            <p className="m-0 mt-2 text-xs text-[var(--text-faint)]">
              {sentThisMonth >= monthlyCap
                ? "Limite atteinte : les prochaines échéances du mois ne seront pas signalées."
                : "Au-delà, les échéances du mois ne sont plus signalées par e-mail."}
            </p>
          </div>
          <Link href="/reglages?formule=pro#formules" className="btn-secondary h-10 px-4 text-[13px]">
            <Lock className="size-3.5" />
            Illimité avec Pro
          </Link>
        </section>
      )}

      <section className="card-sheen anim-up rounded-[var(--radius-xl)] border border-[var(--border)] p-5">
        <h2 className="mt-0 mb-3 flex items-center gap-2 text-[15px] font-semibold">
          <Bell className="size-4 text-[var(--accent-light)]" />
          À venir
        </h2>

        <UpcomingAlerts
          alerts={(upcoming ?? []).map((alert) => {
            // La clé de dédoublonnage porte l'échéance visée :
            // « subscription:<id>:2026-10-17:j-7 ».
            const due = /:(\d{4}-\d{2}-\d{2}):/.exec(alert.dedup_key ?? "")?.[1] ?? null;
            const cycle =
              alert.ref_type === "subscription" && alert.kind === "deadline"
                ? (cycles.get(alert.ref_id) ?? null)
                : null;
            return {
              id: alert.id,
              title: alert.title,
              alert_date: alert.alert_date,
              kind: alert.kind,
              due,
              cycle,
              group: `${alert.ref_type}:${alert.ref_id}:${alert.kind}:${due ?? alert.id}:${alert.title}`,
            };
          })}
        />
        <div className="mt-4 flex flex-col">
          <NewReminder targets={targets} today={todayIso()} />
        </div>
      </section>

      {(subscriptions ?? []).length > 0 && (
        <section className="card-sheen anim-up rounded-[var(--radius-xl)] border border-[var(--border)] p-5">
          <h2 className="mt-0 mb-1 flex items-center gap-2 text-[15px] font-semibold">
            <Bell className="size-4 text-[var(--accent-light)]" />
            Rappels automatiques
          </h2>
          <p className="m-0 mb-3 text-xs text-[var(--text-faint)]">
            Par abonnement, coupe ceux dont tu n’as pas besoin.
          </p>
          <ReminderSwitches settings={subscriptions ?? []} />
        </section>
      )}

      {(sent ?? []).length > 0 && (
        <section className="card-sheen anim-up rounded-[var(--radius-xl)] border border-[var(--border)] p-5">
          <h2 className="mt-0 mb-3 flex items-center gap-2 text-[15px] font-semibold text-[var(--text-dim)]">
            <BellOff className="size-4" />
            Déjà envoyées
          </h2>
          <ul className="m-0 list-none space-y-0.5 p-0">
            {(sent ?? []).map((alert) => (
              <li
                key={alert.id}
                className="flex items-center justify-between gap-3 px-2 py-2 text-sm opacity-60"
              >
                <span className="truncate">{alert.title}</span>
                <span className="shrink-0 text-xs text-[var(--text-faint)]">
                  {formatDate(alert.alert_date)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
