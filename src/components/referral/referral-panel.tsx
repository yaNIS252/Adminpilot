import { Check, Clock, UserPlus } from "lucide-react";

import { ShareActions } from "@/components/referral/share-actions";
import { formatDate } from "@/lib/format";

type Row = {
  id: string;
  label: string;
  status: "signed_up" | "pending" | "validated" | "capped";
  createdAt: string;
};

const STATUS: Record<Row["status"], { label: string; className: string }> = {
  signed_up: {
    label: "inscrit",
    className: "bg-[rgba(255,255,255,.06)] text-[var(--text-dim)]",
  },
  pending: {
    label: "en attente de validation",
    className: "bg-[rgba(224,161,56,.14)] text-[var(--warning-light)]",
  },
  validated: {
    label: "validé",
    className: "bg-[rgba(63,207,149,.14)] text-[var(--positive-light)]",
  },
  capped: {
    label: "plafond atteint",
    className: "bg-[rgba(255,255,255,.06)] text-[var(--text-faint)]",
  },
};

/** Section « Parrainage » des réglages. */
export function ReferralPanel({
  link,
  rows,
  earned,
  maxMonths,
  minSubscriptions,
  minAgeDays,
}: {
  link: string;
  rows: Row[];
  earned: number;
  maxMonths: number;
  minSubscriptions: number;
  minAgeDays: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm leading-[1.6] text-[var(--text-dim)]">
        Chaque proche qui s’inscrit avec ton lien reçoit{" "}
        <strong className="text-[var(--text)]">1 mois de Pro</strong> dès que
        son transfert d’e-mails fonctionne. Toi, tu reçois{" "}
        <strong className="text-[var(--text)]">1 mois de Pro</strong> quand il
        a {minSubscriptions} abonnements détectés et un compte de plus de{" "}
        {minAgeDays} jours, ou dès qu’il s’abonne. Si tu paies déjà, le mois
        est déduit de ta prochaine facture.
      </p>

      <code className="mono overflow-x-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface-alt)] px-3.5 py-2.5 text-[13px] whitespace-nowrap select-all">
        {link}
      </code>
      <ShareActions
        link={link}
        message="J’utilise AdminPilot pour suivre mes abonnements et mes factures. Avec mon lien, tu as 1 mois de Pro offert :"
      />

      <div className="flex items-baseline justify-between border-t border-[var(--border-soft)] pt-4">
        <span className="text-sm font-medium">Tes filleuls</span>
        <span className="mono text-[13px] text-[var(--text-dim)]">
          {earned} / {maxMonths} mois offerts
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="m-0 flex items-center gap-2 text-sm text-[var(--text-faint)]">
          <UserPlus className="size-4 shrink-0" />
          Personne pour l’instant. Ton lien est prêt à être partagé.
        </p>
      ) : (
        <ul className="m-0 list-none p-0">
          {rows.map((row) => {
            const status = STATUS[row.status];
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 border-b border-[var(--border-soft)] py-2.5 last:border-b-0"
              >
                <span className="min-w-[8rem] flex-1 text-sm">{row.label}</span>
                <span className="text-xs text-[var(--text-faint)]">
                  {formatDate(row.createdAt.slice(0, 10))}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}
                >
                  {row.status === "validated" ? (
                    <Check className="size-3" />
                  ) : row.status === "pending" ? (
                    <Clock className="size-3" />
                  ) : null}
                  {status.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
