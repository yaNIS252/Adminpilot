import "server-only";

import { monthlyEquivalent } from "@/lib/format";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Doublons du foyer : le même service payé par plusieurs membres d'un foyer
 * Premium (deux Spotify, deux Netflix…), là où une offre Duo ou Famille
 * coûterait moins cher.
 *
 * Les abonnements d'un membre restent privés : seuls ceux qui l'ont accepté
 * (`household_share`) sont comparés, et l'on ne dit jamais QUI paie quoi,
 * seulement combien de membres paient le même service.
 */

export type HouseholdDuplicate = {
  provider: string;
  /** Membres du foyer (toi compris) qui paient ce service. */
  payers: number;
  /** Ce que tu paies, ramené au mois. */
  myMonthly: number;
  /** Total payé par le foyer pour ce service, ramené au mois. */
  totalMonthly: number;
};

function key(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(premium|famille|family|duo|individuel|standard|essentiel|etudiant)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export async function householdDuplicates(
  db: Db,
  userId: string,
): Promise<{ inHousehold: boolean; sharing: boolean; others: number; duplicates: HouseholdDuplicate[] }> {
  // Foyer de l'utilisateur : celui qu'il possède, ou celui qu'il a rejoint.
  const { data: asMember } = await db
    .from("family_members")
    .select("owner_id")
    .eq("member_id", userId)
    .maybeSingle();
  const ownerId = asMember?.owner_id ?? userId;
  const { data: links } = await db
    .from("family_members")
    .select("member_id")
    .eq("owner_id", ownerId)
    .not("member_id", "is", null);
  const ids = [ownerId, ...(links ?? []).map((link) => link.member_id as string)];
  if (ids.length < 2) return { inHousehold: false, sharing: false, others: 0, duplicates: [] };

  const { data: profiles } = await db
    .from("profiles")
    .select("id, household_share, plan")
    .in("id", ids)
    .is("deleted_at", null);
  const sharers = (profiles ?? []).filter((p) => p.household_share && p.plan === "family").map((p) => p.id);
  const sharing = sharers.includes(userId);
  const others = sharers.filter((id) => id !== userId).length;
  if (!sharing || others === 0) return { inHousehold: true, sharing, others, duplicates: [] };

  const { data: subs } = await db
    .from("subscriptions")
    .select("user_id, provider, amount, cycle, metadata")
    .in("user_id", sharers)
    .eq("status", "active")
    .eq("over_quota", false);

  const byProvider = new Map<string, { label: string; perUser: Map<string, number> }>();
  for (const sub of subs ?? []) {
    if ((sub.metadata as { source?: string } | null)?.source === "adminpilot_billing") continue;
    const id = key(sub.provider);
    if (id.length < 3) continue;
    const entry = byProvider.get(id) ?? { label: sub.provider, perUser: new Map<string, number>() };
    if (sub.user_id === userId) entry.label = sub.provider;
    entry.perUser.set(
      sub.user_id,
      (entry.perUser.get(sub.user_id) ?? 0) + monthlyEquivalent(sub.amount, sub.cycle),
    );
    byProvider.set(id, entry);
  }

  const duplicates = [...byProvider.values()]
    .filter((entry) => entry.perUser.has(userId) && entry.perUser.size >= 2)
    .map((entry) => ({
      provider: entry.label,
      payers: entry.perUser.size,
      myMonthly: entry.perUser.get(userId) ?? 0,
      totalMonthly: [...entry.perUser.values()].reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => b.totalMonthly - a.totalMonthly);

  return { inHousehold: true, sharing, others, duplicates };
}
