"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  FolderClosed,
  LayoutDashboard,
  Lock,
  LogOut,
  Plus,
  Repeat,
  Settings,
} from "lucide-react";

import { LogoMark } from "@/components/marketing/logo-mark";
import { Avatar } from "@/components/shared/avatar";
import { PLAN_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

/**
 * Navigation de l'espace client.
 *
 * Panneau en verre dépoli sur écran large, barre inférieure sur mobile — c'est
 * là que se fait le scan de documents par photo, donc la navigation doit rester
 * à portée de pouce.
 *
 * Le quota et la carte utilisateur sont masqués sur mobile : ils voleraient la
 * place des cinq entrées de navigation.
 */

const LINKS = [
  { href: "/dashboard", label: "Vue d'ensemble", short: "Accueil", Icon: LayoutDashboard },
  { href: "/abonnements", label: "Abonnements", short: "Abos", Icon: Repeat },
  { href: "/documents", label: "Documents", short: "Docs", Icon: FolderClosed },
  { href: "/alertes", label: "Alertes", short: "Alertes", Icon: Bell },
  { href: "/reglages", label: "Réglages", short: "Réglages", Icon: Settings },
] as const;

export function Sidebar({
  plan,
  email,
  name,
  avatarUrl,
  reviewCount,
  documentsUsed,
  documentsLimit,
}: {
  plan: keyof typeof PLAN_LABELS;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  reviewCount: number;
  documentsUsed: number;
  documentsLimit: number | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const quotaRatio =
    documentsLimit === null ? 0 : Math.min(1, documentsUsed / documentsLimit);

  return (
    <nav
      className="
        fixed bottom-0 left-0 z-20 flex w-full justify-around border-t
        border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-xl
        pb-[env(safe-area-inset-bottom,0px)]
        md:sticky md:top-0 md:h-dvh md:w-[252px] md:shrink-0 md:flex-col
        md:justify-start md:border-t-0 md:bg-transparent md:p-3.5
      "
    >
      <div className="hidden h-full flex-col gap-1 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[rgba(255,255,255,.02)] px-3 py-3.5 backdrop-blur-xl md:flex">
        <div className="flex items-center gap-2.5 px-1.5 pt-1 pb-[18px]">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 text-[var(--text)] hover:text-[var(--text)]"
          >
            <LogoMark />
            <span className="text-[15px] tracking-[-0.01em]">
              <span className="font-normal">Admin</span>
              <span className="font-bold">Pilot</span>
            </span>
          </Link>
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
              plan === "free"
                ? "bg-[rgba(255,255,255,.06)] text-[var(--text-faint)]"
                : "bg-[rgb(var(--accent-rgb)/.18)] text-[var(--accent-lighter)]"
            }`}
          >
            {PLAN_LABELS[plan]}
          </span>
        </div>

        {LINKS.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          const badge = href === "/abonnements" ? reviewCount : 0;

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-2.5 rounded-[var(--radius-xs)] px-2.5 py-[9px] text-sm no-underline transition-colors ${
                active
                  ? "bg-[rgb(var(--accent-rgb)/.14)] text-[var(--accent-lighter)] shadow-[inset_2px_0_0_var(--accent)]"
                  : "text-[#7a7a8c] hover:bg-[rgba(255,255,255,.04)] hover:text-[var(--text)]"
              }`}
            >
              <Icon className="size-[17px] shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {badge > 0 && (
                <span
                  title={`${badge} à vérifier`}
                  className="min-w-5 rounded-full bg-[rgba(224,161,56,.16)] px-1.5 py-px text-center text-[11px] font-semibold text-[var(--warning-light)]"
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}

        <Link
          href="/documents"
          className="btn-primary mt-3.5 h-10 text-sm"
        >
          <Plus className="size-4" />
          Ajouter un document
        </Link>

        <div className="flex-1" />

        {documentsLimit !== null && (
          <Link
            href="/reglages?formule=pro#formules"
            className="group mb-2.5 block rounded-[var(--radius-md)] border border-[var(--border)] bg-[rgba(255,255,255,.02)] p-3.5 text-[var(--text)] no-underline transition-colors hover:border-[rgb(var(--accent-rgb)/.4)] hover:text-[var(--text)]"
          >
            <div className="flex justify-between text-xs text-[var(--text-faint)]">
              <span>Documents</span>
              <span className="mono text-[var(--text-muted)]">
                {documentsUsed} / {documentsLimit}
              </span>
            </div>
            <div className="mt-2 h-[5px] overflow-hidden rounded-[5px] bg-[rgba(255,255,255,.06)]">
              <div
                className="h-full bg-[var(--accent)]"
                style={{ width: `${Math.max(3, quotaRatio * 100)}%` }}
              />
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-[var(--accent-lighter)]">
              <Lock className="size-3" />
              Tout illimité avec Pro
            </div>
          </Link>
        )}

        <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[rgba(255,255,255,.03)] p-2">
          <Avatar name={name ?? email} url={avatarUrl} size={34} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">
              {name ?? "Mon compte"}
            </div>
            <div className="truncate text-[11px] text-[var(--text-faint)]">
              {email}
            </div>
          </div>
          <Link
            href="/reglages"
            title="Réglages"
            className="grid size-[30px] shrink-0 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[rgba(255,255,255,.06)] hover:text-white"
          >
            <Settings className="size-4" />
          </Link>
          <button
            type="button"
            onClick={signOut}
            title="Déconnexion"
            className="grid size-[30px] shrink-0 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[rgba(240,113,104,.12)] hover:text-[var(--danger)]"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>

      {/* Barre inférieure mobile.
          Libellés raccourcis : à cinq entrées sur 375 px, « Vue d'ensemble »
          passe à la ligne et déborde de la barre. Le libellé complet reste
          porté par `aria-label` pour les lecteurs d'écran. */}
      {LINKS.map(({ href, label, short, Icon }) => {
        const active = pathname.startsWith(href);
        const badge = href === "/abonnements" ? reviewCount : 0;

        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium whitespace-nowrap no-underline md:hidden ${
              active
                ? "text-[var(--accent-lighter)]"
                : "text-[var(--text-faint)]"
            }`}
          >
            <span className="relative">
              <Icon className="size-5" />
              {badge > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[15px] rounded-full bg-[var(--warning)] px-1 text-[9px] font-bold text-black">
                  {badge}
                </span>
              )}
            </span>
            {short}
          </Link>
        );
      })}
    </nav>
  );
}
