"use client";

import { useRouter } from "next/navigation";
import { Bell, BellOff, Plus, TrendingUp, X } from "lucide-react";
import { useState } from "react";

import { formatDate, formatRelativeDeadline } from "@/lib/format";

/**
 * Alertes : celles à venir (qu'on peut couper), les rappels créés à la main
 * et l'interrupteur des rappels automatiques par abonnement.
 *
 * Un produit qui notifie trop finit désinstallé : chaque alerte doit pouvoir
 * être coupée en un clic, sans passer par les réglages.
 */

export type UpcomingAlert = {
  id: string;
  title: string;
  alert_date: string;
  kind: string;
  /** Échéance visée (renouvellement, fin d'engagement…), si connue. */
  due: string | null;
  /** Fréquence de l'abonnement, pour un renouvellement. */
  cycle: string | null;
  /** Rappels d'une même échéance (7 jours avant, la veille) : une seule ligne. */
  group: string;
};

export type Target = { id: string; type: "subscription" | "document"; label: string };

export type ReminderSetting = {
  id: string;
  provider: string;
  next_renewal: string | null;
  reminders_muted: boolean;
};

const RECURRENCE: Record<string, string> = {
  monthly: "chaque mois",
  yearly: "chaque année",
  quarterly: "chaque trimestre",
  weekly: "chaque semaine",
};

const KIND_LABELS: Record<string, string> = {
  deadline: "Échéance",
  price_change: "Hausse de prix",
  manual: "Mon rappel",
};

export function UpcomingAlerts({ alerts }: { alerts: UpcomingAlert[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cut(ids: string[], key: string) {
    setBusy(key);
    setError(null);
    const responses = await Promise.all(
      ids.map((id) => fetch(`/api/alerts?id=${id}`, { method: "DELETE" }).catch(() => null)),
    );
    setBusy(null);
    if (responses.every((response) => response?.ok)) router.refresh();
    else setError("L’alerte n’a pas pu être coupée. Réessaie.");
  }

  if (alerts.length === 0) {
    return (
      <p className="m-0 py-8 text-center text-sm text-[var(--text-faint)]">
        Aucune alerte programmée.
      </p>
    );
  }

  // Une ligne par échéance, ses rappels (déjà triés par date) regroupés.
  const groups = [...alerts.reduce((map, alert) => {
    map.set(alert.group, [...(map.get(alert.group) ?? []), alert]);
    return map;
  }, new Map<string, UpcomingAlert[]>()).entries()];

  return (
    <>
      {error && (
        <p role="alert" className="m-0 mb-2 text-[13px] text-[var(--danger-light)]">
          {error}
        </p>
      )}
      <ul className="m-0 list-none space-y-0.5 p-0">
        {groups.map(([key, items]) => {
          const first = items[0];
          const target = first.due ?? first.alert_date;
          const cycle = first.cycle ? (RECURRENCE[first.cycle] ?? null) : null;
          const reminders = items.map((item) => formatDate(item.alert_date)).join(" et ");
          return (
            <li
              key={key}
              className="flex items-center gap-3 rounded-[var(--radius-sm)] px-2 py-2.5 transition-colors hover:bg-[rgba(255,255,255,.04)]"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[rgba(255,255,255,.05)] text-[var(--accent-light)]">
                {first.kind === "price_change" ? (
                  <TrendingUp className="size-3.5 text-[var(--warning-light)]" />
                ) : (
                  <Bell className="size-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{first.title}</div>
                <div className="text-xs text-[var(--text-faint)]">
                  {KIND_LABELS[first.kind] ?? "Alerte"} · {formatDate(target)}
                  {cycle ? ` · ${cycle}` : ""}
                </div>
                <div className="text-xs text-[var(--text-faint)]">
                  {items.length > 1 ? "Rappels" : "Rappel"} le {reminders}
                </div>
              </div>
              <span className="hidden shrink-0 rounded-full bg-[rgba(255,255,255,.05)] px-2.5 py-1 text-[11px] text-[var(--text-dim)] sm:inline">
                {formatRelativeDeadline(target)}
              </span>
              <button
                type="button"
                onClick={() => cut(items.map((item) => item.id), key)}
                disabled={busy === key}
                title="Couper ces rappels"
                aria-label={`Couper les rappels « ${first.title} »`}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[rgba(240,113,104,.12)] hover:text-[var(--danger)] disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function NewReminder({ targets, today }: { targets: Target[]; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (targets.length === 0) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary h-10 self-start px-4 text-sm">
        <Plus className="size-4" />
        Créer un rappel
      </button>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const [type, id] = String(form.get("target")).split(":");
    setBusy(true);
    setError(null);
    const response = await fetch("/api/alerts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ref_type: type,
        ref_id: id,
        title: String(form.get("title") ?? ""),
        message: String(form.get("message") ?? ""),
        alert_date: String(form.get("date") ?? ""),
      }),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(
        response?.status === 400
          ? "Vérifie la date (aujourd’hui ou plus tard, dans les deux ans) et le titre."
          : "Le rappel n’a pas pu être créé. Réessaie.",
      );
    }
  }

  const field =
    "h-10 rounded-[8px] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 text-sm outline-none focus:border-[var(--accent)]";

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-[10px] border border-[var(--border)] p-4">
      <div className="text-[13px] font-medium">Nouveau rappel</div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-[var(--text-dim)]">À propos de</span>
        <select name="target" required className={field}>
          {targets.map((target) => (
            <option key={`${target.type}:${target.id}`} value={`${target.type}:${target.id}`} className="bg-[var(--bg-elevated)]">
              {target.type === "subscription" ? "Abonnement" : "Document"} · {target.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
          <span className="text-xs text-[var(--text-dim)]">Date</span>
          <input type="date" name="date" required min={today} defaultValue={today} className={field} />
        </label>
        <label className="flex min-w-[220px] flex-[2] flex-col gap-1.5">
          <span className="text-xs text-[var(--text-dim)]">Titre</span>
          <input name="title" required maxLength={160} placeholder="Penser à résilier avant la fin de l’essai" className={field} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-[var(--text-dim)]">Note (facultatif)</span>
        <textarea name="message" rows={2} maxLength={500} className="rounded-[8px] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary h-10 px-4 text-sm disabled:opacity-60">
          {busy ? "Création…" : "Programmer le rappel"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary h-10 px-4 text-sm">
          Annuler
        </button>
      </div>
      <p className="m-0 text-xs text-[var(--text-faint)]">Envoyé par e-mail le matin du jour choisi.</p>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-[var(--danger-light)]">
          {error}
        </p>
      )}
    </form>
  );
}

export function ReminderSwitches({ settings }: { settings: ReminderSetting[] }) {
  const router = useRouter();
  const [state, setState] = useState(() => Object.fromEntries(settings.map((s) => [s.id, !s.reminders_muted])));
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string) {
    const enabled = !state[id];
    setState((current) => ({ ...current, [id]: enabled }));
    setError(null);
    const response = await fetch("/api/subscriptions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, reminders_muted: !enabled }),
    }).catch(() => null);
    if (response?.ok) {
      router.refresh();
    } else {
      setState((current) => ({ ...current, [id]: !enabled }));
      setError("Le changement n’a pas pu être enregistré.");
    }
  }

  if (settings.length === 0) return null;

  return (
    <>
      <ul className="m-0 list-none p-0">
        {settings.map((setting) => {
          const enabled = state[setting.id];
          return (
            <li key={setting.id} className="flex items-center gap-3 border-b border-[var(--border-soft)] py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{setting.provider}</div>
                <div className="text-xs text-[var(--text-faint)]">
                  {setting.next_renewal
                    ? `Échéance le ${formatDate(setting.next_renewal)} · rappels 7 jours et 1 jour avant`
                    : "Échéance inconnue : aucun rappel automatique possible"}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`Rappels d’échéance pour ${setting.provider}`}
                onClick={() => toggle(setting.id)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  enabled ? "bg-[var(--accent)]" : "bg-[rgba(255,255,255,.12)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${enabled ? "left-[22px]" : "left-0.5"}`}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="m-0 mt-3 flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
        <BellOff className="size-3" />
        Couper les rappels d’un abonnement ne coupe pas les alertes de hausse de prix.
      </p>
      {error && (
        <p role="alert" className="m-0 mt-2 text-[13px] text-[var(--danger-light)]">
          {error}
        </p>
      )}
    </>
  );
}
