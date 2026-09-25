import { Bell, BellOff } from "lucide-react";

import { formatDate, formatRelativeDeadline } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Alertes — AdminPilot" };

export default async function AlertsPage() {
  const supabase = await createClient();

  const [{ data: upcoming }, { data: sent }] = await Promise.all([
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
  ]);

  return (
    <div className="flex flex-col gap-5">
      <header className="anim-up">
        <h1 className="serif m-0 text-[36px] leading-[1.05]">Alertes</h1>
        <p className="m-0 mt-1 max-w-xl text-sm text-[var(--text-dim)]">
          Créées automatiquement sept jours puis un jour avant chaque échéance
          connue. Une détection non vérifiée n’en déclenche aucune.
        </p>
      </header>

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
