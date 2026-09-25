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
 * `perspective` + `rotateX` donnent l'inclinaison ; le conteneur d'un pixel en
 * dégradé fait le liseré lumineux du bord supérieur.
 */
export function HeroMockup() {
  return (
    <div className="relative mx-auto mt-[72px] max-w-[1040px] [perspective:1600px]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[10%] top-[10%] -bottom-[10%] blur-[40px]"
        style={{
          background:
            "radial-gradient(closest-side,rgba(139,124,240,.45),transparent)",
        }}
      />

      <div
        className="relative rounded-[18px] bg-gradient-to-b from-[rgba(255,255,255,.22)] to-[rgba(255,255,255,.03)] p-px shadow-[0_40px_120px_-30px_rgba(0,0,0,.9)]"
        style={{ transform: "rotateX(12deg)", transformOrigin: "50% 0" }}
      >
        <div className="overflow-hidden rounded-[17px] bg-[var(--bg-elevated)] text-left">
          {/* Barre de fenêtre */}
          <div className="flex items-center gap-[7px] border-b border-[var(--border-soft)] px-4 py-3">
            <span className="size-2.5 rounded-full bg-[#3a3a46]" />
            <span className="size-2.5 rounded-full bg-[#3a3a46]" />
            <span className="size-2.5 rounded-full bg-[#3a3a46]" />
            <div className="mono mx-auto rounded-[7px] bg-[rgba(255,255,255,.04)] px-3.5 py-1 text-[11px] text-[var(--text-ghost)]">
              adminpilot.fr/dashboard
            </div>
          </div>

          <div className="flex min-h-[380px]">
            <div className="hidden w-[180px] shrink-0 flex-col gap-1 border-r border-[var(--border-soft)] bg-[rgba(255,255,255,.015)] px-3 py-4 sm:flex">
              <div className="flex items-center gap-2 px-2 pt-1.5 pb-3.5 text-[13px] font-bold">
                <span className="size-[18px] rounded-md bg-gradient-to-br from-[#8b7cf0] to-[#3b2fa8]" />
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
              <div className="text-[15px] font-semibold">Bonjour Yanis 👋</div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <MockStat label="Par mois" value="195,18 €">
                  <span className="text-[10px] text-[var(--positive)]">
                    5 abonnements
                  </span>
                </MockStat>
                <MockStat label="Sur un an" value="2 342,16 €">
                  <span className="mt-2 block h-1 overflow-hidden rounded bg-[rgba(255,255,255,.07)]">
                    <span className="block h-full w-[74%] bg-gradient-to-r from-[#6f7cf5] to-[#8b7cf0]" />
                  </span>
                </MockStat>
                <MockStat label="Actifs" value="8" className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-[var(--warning)]">
                    2 à vérifier
                  </span>
                </MockStat>
              </div>

              <div className="flex flex-1 flex-col gap-2 rounded-[11px] border border-[var(--border)] bg-[rgba(255,255,255,.02)] p-3">
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
                        className="block h-full bg-gradient-to-r from-[#6f7cf5] to-[#8b7cf0]"
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
          ? "bg-[rgba(139,124,240,.14)] text-[var(--accent-lighter)] shadow-[inset_2px_0_0_#8b7cf0]"
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
    <div className={`rounded-[11px] border border-[var(--border)] bg-[rgba(255,255,255,.025)] p-3 ${className}`}>
      <div className="text-[10px] text-[var(--text-faint)]">{label}</div>
      <div className="mono mt-1 text-[15px] font-semibold sm:text-[17px]">{value}</div>
      {children}
    </div>
  );
}
