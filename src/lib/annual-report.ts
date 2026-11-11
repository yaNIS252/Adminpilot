import "server-only";

import { monthlyEquivalent } from "@/lib/format";
import { periodsPerYear } from "@/lib/ingest/price-tracker";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Bilan annuel (Premium) : ce que coûtent les abonnements sur un an, ce qui
 * a bougé dans l'année, et les documents rangés. Lu sous l'identité de
 * l'utilisateur (RLS) : seulement ses données.
 *
 * Ne dit que ce que les données disent : le coût annuel est celui des
 * abonnements actifs au rythme actuel, pas une reconstitution des paiements
 * passés que l'application n'a pas tous vus.
 */

export type AnnualReport = {
  year: number;
  yearlyTotal: number;
  monthlyTotal: number;
  active: { provider: string; category: string; amount: number | null; cycle: string; yearly: number }[];
  byCategory: { category: string; yearly: number }[];
  started: { provider: string; date: string; yearly: number }[];
  cancelled: { provider: string; date: string; yearlySaved: number }[];
  priceChanges: { provider: string; date: string; oldAmount: number; newAmount: number; yearlyImpact: number }[];
  increases: number;
  decreases: number;
  savedByCancelling: number;
  documents: { category: string; count: number }[];
  documentsTotal: number;
};

export async function buildAnnualReport(db: Db, year: number): Promise<AnnualReport> {
  const start = `${year}-01-01T00:00:00Z`;
  const end = `${year + 1}-01-01T00:00:00Z`;

  const [{ data: subs }, { data: changes }, { data: docs }] = await Promise.all([
    db
      .from("subscriptions")
      .select("provider, category, amount, cycle, status, detected_at, cancelled_at, metadata")
      .eq("over_quota", false),
    db
      .from("price_changes")
      .select("old_amount, new_amount, cycle, created_at, effective_date, subscriptions!inner(provider)")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true }),
    db.from("documents").select("category").gte("created_at", start).lt("created_at", end),
  ]);

  const yearlyOf = (amount: number | null, cycle: string) => monthlyEquivalent(amount, cycle) * 12;
  const rows = (subs ?? []).filter((sub) => !(sub.metadata as { bonus?: boolean } | null)?.bonus);

  const active = rows
    .filter((sub) => sub.status === "active")
    .map((sub) => ({
      provider: sub.provider,
      category: sub.category ?? "autre",
      amount: sub.amount,
      cycle: sub.cycle,
      yearly: yearlyOf(sub.amount, sub.cycle),
    }))
    .sort((a, b) => b.yearly - a.yearly);
  const yearlyTotal = active.reduce((sum, sub) => sum + sub.yearly, 0);

  const byCategory = [
    ...active
      .reduce((map, sub) => map.set(sub.category, (map.get(sub.category) ?? 0) + sub.yearly), new Map<string, number>())
      .entries(),
  ]
    .map(([category, yearly]) => ({ category, yearly }))
    .filter((row) => row.yearly > 0)
    .sort((a, b) => b.yearly - a.yearly);

  const inYear = (date: string | null) => Boolean(date && date >= start && date < end);
  const started = rows
    .filter((sub) => inYear(sub.detected_at))
    .map((sub) => ({ provider: sub.provider, date: sub.detected_at.slice(0, 10), yearly: yearlyOf(sub.amount, sub.cycle) }));
  const cancelled = rows
    .filter((sub) => sub.status === "cancelled" && inYear(sub.cancelled_at))
    .map((sub) => ({
      provider: sub.provider,
      date: (sub.cancelled_at as string).slice(0, 10),
      yearlySaved: yearlyOf(sub.amount, sub.cycle),
    }));

  const priceChanges = (changes ?? []).map((change) => ({
    provider: (change.subscriptions as unknown as { provider: string }).provider,
    date: (change.effective_date ?? change.created_at).slice(0, 10),
    oldAmount: Number(change.old_amount),
    newAmount: Number(change.new_amount),
    yearlyImpact: (Number(change.new_amount) - Number(change.old_amount)) * periodsPerYear(change.cycle),
  }));

  const documentCounts = (docs ?? []).reduce(
    (map, doc) => map.set(doc.category ?? "autre", (map.get(doc.category ?? "autre") ?? 0) + 1),
    new Map<string, number>(),
  );

  return {
    year,
    yearlyTotal,
    monthlyTotal: yearlyTotal / 12,
    active,
    byCategory,
    started,
    cancelled,
    priceChanges,
    increases: priceChanges.filter((c) => c.yearlyImpact > 0).reduce((sum, c) => sum + c.yearlyImpact, 0),
    decreases: priceChanges.filter((c) => c.yearlyImpact < 0).reduce((sum, c) => sum + c.yearlyImpact, 0),
    savedByCancelling: cancelled.reduce((sum, sub) => sum + sub.yearlySaved, 0),
    documents: [...documentCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    documentsTotal: (docs ?? []).length,
  };
}

/** Année demandée dans l'URL, bornée ; par défaut l'année en cours. */
export function reportYear(value: string | null | undefined): number {
  const current = new Date().getUTCFullYear();
  const year = Number(value);
  return Number.isInteger(year) && year >= 2024 && year <= current ? year : current;
}
