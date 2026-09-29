import Link from "next/link";
import { Bell, BellOff, Lock } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { currentPeriod } from "@/lib/billing/quotas";
import { PLAN_LIMITS } from "@/lib/constants";
import { formatDate, formatRelativeDeadline } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Alertes — AdminPilot" };

export default async function AlertsPage() {
  const auth = await requireUser();
  const supabase = await createClient();
  const monthlyCap = auth ? PLAN_LIMITS[auth.profile.plan].alerts : null;

  const [{ data: upcoming }, { data: sent }, { data: usage }] = await Promise.all([
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
  ]);

  const sentThisMonth = usage?.alerts_count ?? 0;

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

        {(upcoming ?? []).length === 0 ? (
          <p className="m-0 py-8 text-center text-sm text-[var(--text-faint)]">
            Aucune alerte programmée.
          </p>
        ) : (
          <ul className="m-0 list-none space-y-0.5 p-0">
            {(upcoming ?? []).map((alert) => (
              <li
                key={alert.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] px-2 py-2.5 transition-colors hover:bg-[rgba(255,255,255,.04)]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {alert.title}
                  </div>
                  <div className="text-xs text-[var(--text-faint)]">
                    {formatDate(alert.alert_date)}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-[rgba(255,255,255,.05)] px-2.5 py-1 text-[11px] text-[var(--text-dim)]">
                  {formatRelativeDeadline(alert.alert_date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
