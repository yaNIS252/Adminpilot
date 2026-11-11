import Link from "next/link";
import { FileSpreadsheet, Lock } from "lucide-react";

import { PrintButton } from "@/components/shared/print-button";
import { buildAnnualReport, reportYear } from "@/lib/annual-report";
import { requireUser } from "@/lib/auth/require-user";
import { formatAmount, formatCycle, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Bilan annuel — AdminPilot" };

const CATEGORY_LABELS: Record<string, string> = {
  streaming: "Streaming",
  energie: "Énergie",
  telecom: "Box et mobile",
  assurance: "Assurance",
  banque: "Banque",
  transport: "Transport",
  logement: "Logement",
  sante: "Santé",
  logiciel: "Logiciels",
  presse: "Presse",
  sport: "Sport",
  autre: "Autre",
  facture: "Factures",
  contrat: "Contrats",
  impots: "Impôts",
  vehicule: "Véhicule",
  identite: "Identité",
  travail: "Travail",
};

/**
 * Bilan annuel (Premium) : une page à imprimer ou à enregistrer en PDF, et
 * le même contenu à télécharger pour Excel.
 */
export default async function AnnualReportPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string }>;
}) {
  const auth = await requireUser();
  const year = reportYear((await searchParams).annee);
  const currentYear = new Date().getUTCFullYear();

  if (!auth || auth.profile.plan !== "family") {
    return (
      <div className="flex flex-col gap-5">
        <header className="anim-up">
          <h1 className="serif m-0 text-[36px] leading-[1.05]">Bilan annuel</h1>
        </header>
        <section className="card-sheen anim-up flex flex-wrap items-center gap-4 rounded-[var(--radius-xl)] border border-[rgb(var(--accent-rgb)/.4)] bg-[var(--accent-soft)] p-5">
          <Lock className="size-5 shrink-0 text-[var(--accent-lighter)]" />
          <p className="m-0 min-w-[220px] flex-1 text-sm leading-[1.6] text-[var(--text-dim)]">
            Ce que tes abonnements t’ont coûté sur l’année, les hausses subies, ce que tu as
            économisé en résiliant, et tes documents rangés : en PDF ou pour Excel, avec{" "}
            <strong className="text-[var(--text)]">Premium</strong>.
          </p>
          <Link href="/reglages?formule=family#formules" className="btn-primary h-10 px-4 text-[13px]">
            Passer Premium
          </Link>
        </section>
      </div>
    );
  }

  const report = await buildAnnualReport(await createClient(), year);
  const money = (value: number) => formatAmount(value) ?? "—";

  return (
    <div className="flex flex-col gap-5 print:gap-3">
      <header className="anim-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="serif m-0 text-[36px] leading-[1.05]">Bilan {year}</h1>
          <p className="m-0 mt-1 text-sm text-[var(--text-dim)]">
            {auth.profile.name ? `${auth.profile.name} · ` : ""}établi le {formatDate(new Date().toISOString().slice(0, 10))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {year > 2024 && (
            <Link href={`/bilan?annee=${year - 1}`} className="btn-secondary h-10 px-3 text-[13px]">
              {year - 1}
            </Link>
          )}
          {year < currentYear && (
            <Link href={`/bilan?annee=${year + 1}`} className="btn-secondary h-10 px-3 text-[13px]">
              {year + 1}
            </Link>
          )}
          <a href={`/api/account/report?annee=${year}`} className="btn-secondary h-10 px-4 text-[13px]">
            <FileSpreadsheet className="size-4" />
            Pour Excel
          </a>
          <PrintButton />
        </div>
      </header>

      <section className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        <Figure label="Coût annuel des abonnements" value={money(report.yearlyTotal)} note={`${money(report.monthlyTotal)} par mois`} />
        <Figure label="Hausses de prix" value={report.increases > 0 ? `+${money(report.increases)}` : "—"} note="par an, cumulées" />
        <Figure label="Économisé en résiliant" value={report.savedByCancelling > 0 ? money(report.savedByCancelling) : "—"} note="par an" />
        <Figure label="Documents rangés" value={String(report.documentsTotal)} note={`en ${year}`} />
      </section>

      <Block title="Abonnements actifs" empty="Aucun abonnement actif." rows={report.active.length}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--text-faint)]">
              <th className="py-1.5 font-normal">Fournisseur</th>
              <th className="py-1.5 font-normal">Catégorie</th>
              <th className="py-1.5 text-right font-normal">Prix</th>
              <th className="py-1.5 text-right font-normal">Par an</th>
            </tr>
          </thead>
          <tbody>
            {report.active.map((sub, index) => (
              <tr key={`${sub.provider}-${index}`} className="border-t border-[var(--border-soft)]">
                <td className="py-1.5">{sub.provider}</td>
                <td className="py-1.5 text-[var(--text-dim)]">{CATEGORY_LABELS[sub.category] ?? sub.category}</td>
                <td className="py-1.5 text-right text-[var(--text-dim)]">
                  {sub.amount === null ? "—" : `${money(sub.amount)} ${formatCycle(sub.cycle)}`}
                </td>
                <td className="mono py-1.5 text-right">{money(sub.yearly)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>

      <Block title="Par catégorie" empty="" rows={report.byCategory.length}>
        <ul className="m-0 list-none space-y-1 p-0 text-sm">
          {report.byCategory.map((row) => (
            <li key={row.category} className="flex justify-between">
              <span className="text-[var(--text-dim)]">{CATEGORY_LABELS[row.category] ?? row.category}</span>
              <span className="mono">{money(row.yearly)} / an</span>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Changements de prix" empty={`Aucun changement de prix détecté en ${year}.`} rows={report.priceChanges.length}>
        <ul className="m-0 list-none space-y-1 p-0 text-sm">
          {report.priceChanges.map((change, index) => (
            <li key={`${change.provider}-${index}`} className="flex flex-wrap justify-between gap-x-4">
              <span>
                {change.provider}{" "}
                <span className="text-[var(--text-faint)]">· {formatDate(change.date)}</span>
              </span>
              <span className="mono">
                {money(change.oldAmount)} → {money(change.newAmount)} ({change.yearlyImpact > 0 ? "+" : ""}
                {money(change.yearlyImpact)} / an)
              </span>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Résiliés dans l’année" empty={`Aucune résiliation en ${year}.`} rows={report.cancelled.length}>
        <ul className="m-0 list-none space-y-1 p-0 text-sm">
          {report.cancelled.map((sub, index) => (
            <li key={`${sub.provider}-${index}`} className="flex justify-between gap-4">
              <span>
                {sub.provider} <span className="text-[var(--text-faint)]">· {formatDate(sub.date)}</span>
              </span>
              <span className="mono">{money(sub.yearlySaved)} / an économisés</span>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Documents rangés" empty={`Aucun document ajouté en ${year}.`} rows={report.documents.length}>
        <ul className="m-0 list-none space-y-1 p-0 text-sm">
          {report.documents.map((doc) => (
            <li key={doc.category} className="flex justify-between">
              <span className="text-[var(--text-dim)]">{CATEGORY_LABELS[doc.category] ?? doc.category}</span>
              <span className="mono">{doc.count}</span>
            </li>
          ))}
        </ul>
      </Block>

      <p className="m-0 text-xs text-[var(--text-faint)]">
        Coût annuel calculé sur les abonnements actifs au prix actuel. Les paiements que
        l’application n’a pas vus (avant ton inscription, hors e-mail) n’y figurent pas.
      </p>
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card-sheen rounded-[var(--radius-xl)] border border-[var(--border)] p-4">
      <div className="text-xs text-[var(--text-faint)]">{label}</div>
      <div className="mono mt-1 text-[22px] font-semibold">{value}</div>
      <div className="text-xs text-[var(--text-faint)]">{note}</div>
    </div>
  );
}

function Block({
  title,
  empty,
  rows,
  children,
}: {
  title: string;
  empty: string;
  rows: number;
  children: React.ReactNode;
}) {
  if (rows === 0 && !empty) return null;
  return (
    <section className="card-sheen break-inside-avoid rounded-[var(--radius-xl)] border border-[var(--border)] p-5">
      <h2 className="mt-0 mb-3 text-[15px] font-semibold">{title}</h2>
      {rows === 0 ? <p className="m-0 text-sm text-[var(--text-faint)]">{empty}</p> : children}
    </section>
  );
}
