import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, Users } from "lucide-react";

import { JoinHousehold } from "@/components/household/join-household";
import { LogoMark } from "@/components/marketing/logo-mark";
import { requireUser } from "@/lib/auth/require-user";
import { hashToken, membershipOf } from "@/lib/household";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Rejoindre un foyer — AdminPilot",
  robots: { index: false, follow: false },
};

/**
 * Page d'arrivée d'une invitation au foyer Premium.
 *
 * Le middleware a déjà renvoyé vers la connexion si besoin, en gardant cette
 * adresse dans `next` : l'invité crée son compte puis retombe ici. Rien n'est
 * fait à l'ouverture ; le rattachement attend son clic.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const auth = await requireUser();
  if (!auth) redirect(`/login?next=${encodeURIComponent(`/rejoindre/${token}`)}`);

  const db = createAdminClient();
  const { data: invite } = await db
    .from("family_members")
    .select(
      "email, member_id, expires_at, owner_id, owner:profiles!family_members_owner_id_fkey(name, email, plan)",
    )
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  const ownerName = invite?.owner?.name ?? invite?.owner?.email ?? "";
  const membership = await membershipOf(db, auth.userId);

  let problem: string | null = null;
  if (!invite || invite.member_id) {
    problem =
      "Ce lien d’invitation n’est plus valable. Il a peut-être déjà servi : demande à la personne qui t’a invité de t’en renvoyer un.";
  } else if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    problem = `Cette invitation a expiré. Demande à ${ownerName} de t’en renvoyer une depuis ses réglages.`;
  } else if (invite.owner_id === auth.userId) {
    problem =
      "C’est ton propre lien d’invitation. Envoie-le à la personne que tu veux inviter.";
  } else if (invite.owner?.plan !== "family") {
    problem = `L’abonnement Premium de ${ownerName} n’est plus actif, le foyer ne peut pas accueillir de membre pour l’instant.`;
  } else if (membership) {
    problem =
      "Tu fais déjà partie d’un foyer. Quitte-le depuis tes réglages avant d’en rejoindre un autre.";
  } else if (auth.profile.plan !== "free") {
    problem =
      "Tu as déjà un abonnement personnel. Résilie-le depuis tes réglages avant de rejoindre ce foyer, sans quoi tu continuerais à payer pour rien.";
  }

  const emailMismatch =
    invite && invite.email.toLowerCase() !== auth.profile.email.toLowerCase();

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)] px-[clamp(20px,5vw,64px)] py-7">
      <header>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2.5 text-[var(--text)] hover:text-[var(--text)]"
        >
          <LogoMark />
          <span className="text-[15px]">
              <span className="font-normal">Admin</span>
              <span className="font-bold">Pilot</span>
            </span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center py-12">
        <span className="mb-6 grid size-12 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-light)]">
          <Users className="size-5" />
        </span>

        {problem ? (
          <>
            <h1 className="serif m-0 text-[34px] leading-[1.1]">
              Invitation indisponible
            </h1>
            <p className="mt-4 text-[15px] leading-[1.65] text-[var(--text-dim)]">
              {problem}
            </p>
            <Link href="/dashboard" className="btn-secondary mt-6 h-10 self-start px-4 text-sm">
              Aller à mon espace
            </Link>
          </>
        ) : (
          <>
            <h1 className="serif m-0 text-[34px] leading-[1.1]">
              {ownerName} t’invite <em>dans son foyer.</em>
            </h1>
            <p className="mt-4 text-[15px] leading-[1.65] text-[var(--text-dim)]">
              Tu profites de sa formule Premium sur ton propre compte :
              abonnements, documents et alertes illimités, recherche et
              lettres de résiliation.
            </p>
            <p className="mt-0 flex items-start gap-2 text-[13px] leading-[1.6] text-[var(--text-faint)]">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              Tes données restent privées : ni {ownerName} ni les autres
              membres ne voient tes documents ou tes abonnements.
            </p>
            {emailMismatch && (
              <p className="mt-2 text-[13px] text-[var(--warning-light)]">
                L’invitation était adressée à {invite?.email}. Tu es connecté
                avec {auth.profile.email} : c’est ce compte-ci qui rejoindra le
                foyer.
              </p>
            )}
            <JoinHousehold token={token} ownerName={ownerName} />
          </>
        )}
      </main>
    </div>
  );
}
