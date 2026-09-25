import { DetectionFeed } from "@/components/marketing/detection-feed";

import {
  Bell,
  FolderClosed,
  LayoutDashboard,
  Repeat,
} from "lucide-react";

/**
 * Aperçu du produit sous l'accroche.
 *
 * Statique et décoratif : c'est une illustration, pas le vrai tableau de bord.
 * Les montants sont ceux de la maquette — ils illustrent une situation
 * plausible, et le visiteur comprend qu'il s'agit d'un exemple.
 *
 * Posé à plat, sans inclinaison 3D ni halo violet derrière : le tableau de
 * bord penché qui flotte dans une lueur est devenu la signature même des pages
 * d'accueil générées. Un simple cadre montre le produit tel qu'il est.
 */
export function HeroMockup() {
  return (
    <div className="relative mt-16 max-w-[1160px]">
      <div className="relative rounded-[12px] border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-[0_30px_80px_-40px_rgba(0,0,0,.9)]">
        <div className="overflow-hidden rounded-[11px] text-left">
          {/* Barre d'adresse */}
          <div className="flex items-center border-b border-[var(--border-soft)] px-4 py-2.5">
            <div className="mono text-[11px] text-[var(--text-ghost)]">
              adminpilot.fr/dashboard
            </div>
          </div>

          <div className="flex min-h-[380px]">
            <div className="hidden w-[180px] shrink-0 flex-col gap-1 border-r border-[var(--border-soft)] bg-[rgba(255,255,255,.015)] px-3 py-4 sm:flex">
              <div className="flex items-center gap-2 px-2 pt-1.5 pb-3.5 text-[13px] font-bold">
                <span className="size-[18px] rounded-[5px] bg-[var(--accent)]" />
                AdminPilot
              </div>
              <MockNav icon={<LayoutDashboard className="size-3.5" />} active>
                Vue d&apos;ensemble
              </MockNav>
              <MockNav icon={<Repeat className="size-3.5" />}>
                Abonnements
              </MockNav>
              <MockNav icon={<FolderClosed className="size-3.5" />}>
                Documents
              </MockNav>
              <MockNav icon={<Bell className="size-3.5" />}>Alertes</MockNav>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3.5 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="serif text-[22px] leading-none">Ce mois-ci</div>
                <div className="mono text-[10px] text-[var(--text-ghost)]">
                  8 abonnements suivis
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <MockStat label="Par mois" value="195,18 €">
                  <span className="text-[10px] text-[var(--positive)]">
                    5 abonnements
                  </span>
                </MockStat>
                <MockStat label="Sur un an" value="2 342,16 €">
                  <span className="mt-2 block h-1 overflow-hidden rounded bg-[rgba(255,255,255,.07)]">
                    <span className="block h-full w-[74%] bg-[var(--accent)]" />
                  </span>
                </MockStat>
                <MockStat label="Actifs" value="8" className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-[var(--warning)]">
                    2 à vérifier
                  </span>
                </MockStat>
              </div>

              <div className="flex flex-1 flex-col gap-2 rounded-[8px] border border-[var(--border)] p-3">
                <div className="text-[11px] text-[var(--text-faint)]">
                  Répartition · au mois
                </div>
                {[
                  ["Énergie", 86.89, 100],
                  ["Streaming", 50.47, 58],
                  ["Assurance", 32.0, 37],
                  ["Télécom", 19.99, 23],
                ].map(([label, amount, width]) => (
                  <div key={String(label)}>
                    <div className="mb-1 flex justify-between text-[11px]">
                      <span className="text-[var(--text-dim)]">{label}</span>
                      <span className="mono text-[var(--text)]">
                        {String(amount).replace(".", ",")} €
                      </span>
                    </div>
                    <span className="block h-1 overflow-hidden rounded bg-[rgba(255,255,255,.06)]">
                      <span
                        className="block h-full bg-[var(--accent)]"
                        style={{ width: `${width}%` }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DetectionFeed />
    </div>
  );
}

function MockNav({
  icon,
  active,
  children,
}: {
  icon: React.ReactNode;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2.5 py-[7px] text-xs ${
        active
          ? "bg-[rgba(255,255,255,.06)] text-[var(--text-bright)]"
          : "text-[#7a7a8c]"
      }`}
    >
      {icon}
      {children}
    </div>
  );
}

function MockStat({
  label,
  value,
  className = "",
  children,
}: {
  label: string;
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 rounded-[8px] border border-[var(--border)] p-3 ${className}`}>
      <div className="text-[10px] text-[var(--text-faint)]">{label}</div>
      <div className="mono mt-1 text-[14px] font-semibold whitespace-nowrap sm:text-[17px]">
        {value}
      </div>
      {children}
    </div>
  );
}
