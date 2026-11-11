import { NextResponse } from "next/server";

import { buildAnnualReport, reportYear } from "@/lib/annual-report";
import { requireUser } from "@/lib/auth/require-user";
import { consume, tooManyRequests } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Bilan annuel au format tableur (CSV lisible par Excel : séparateur « ; »,
 * virgule décimale, encodage avec BOM pour les accents). Premium.
 */

function cell(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return value.toFixed(2).replace(".", ",");
  // Une cellule commençant par = + - @ serait lue comme une formule par
  // Excel : un nom de fournisseur piégé pourrait en exécuter une.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  if (auth.profile.plan !== "family") {
    return NextResponse.json({ error: "réservé à Premium", code: "upgrade_required" }, { status: 402 });
  }
  if (!(await consume("heavy", auth.userId))) return tooManyRequests("heavy");

  const year = reportYear(new URL(request.url).searchParams.get("annee"));
  const report = await buildAnnualReport(await createClient(), year);

  const lines: (string | number | null)[][] = [
    [`Bilan AdminPilot ${year}`],
    [],
    ["Coût annuel des abonnements actifs", report.yearlyTotal],
    ["Soit par mois", report.monthlyTotal],
    ["Hausses de prix sur un an", report.increases],
    ["Baisses de prix sur un an", report.decreases],
    ["Économisé en résiliant (par an)", report.savedByCancelling],
    [],
    ["ABONNEMENTS ACTIFS"],
    ["Fournisseur", "Catégorie", "Montant", "Périodicité", "Coût par an"],
    ...report.active.map((sub) => [sub.provider, sub.category, sub.amount, sub.cycle, sub.yearly]),
    [],
    ["CHANGEMENTS DE PRIX"],
    ["Fournisseur", "Date", "Ancien prix", "Nouveau prix", "Effet sur un an"],
    ...report.priceChanges.map((c) => [c.provider, c.date, c.oldAmount, c.newAmount, c.yearlyImpact]),
    [],
    ["RÉSILIÉS DANS L'ANNÉE"],
    ["Fournisseur", "Date", "Économie par an"],
    ...report.cancelled.map((sub) => [sub.provider, sub.date, sub.yearlySaved]),
    [],
    ["NOUVEAUX DANS L'ANNÉE"],
    ["Fournisseur", "Date", "Coût par an"],
    ...report.started.map((sub) => [sub.provider, sub.date, sub.yearly]),
    [],
    ["DOCUMENTS RANGÉS"],
    ["Catégorie", "Nombre"],
    ...report.documents.map((doc) => [doc.category, String(doc.count)]),
  ];

  const csv = `﻿${lines.map((line) => line.map(cell).join(";")).join("\r\n")}\r\n`;
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="adminpilot-bilan-${year}.csv"`,
      "cache-control": "no-store",
    },
  });
}
