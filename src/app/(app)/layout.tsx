import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { WelcomeTour } from "@/components/onboarding/welcome-tour";
import { ReferralBanner } from "@/components/referral/referral-banner";
import { Sidebar } from "@/components/shared/sidebar";
import { SESSION_COOKIE, readSession } from "@/lib/auth/session";
import { inboxAddress, requireUser } from "@/lib/auth/require-user";
import { PLAN_LIMITS, REFERRAL_BANNER_COOKIE } from "@/lib/constants";
import { forwardingDomains } from "@/lib/forwarding-domains";
import { siteUrl } from "@/lib/site-url";
import { effectiveTheme } from "@/lib/profile/theme";
import { avatarUrl } from "@/lib/profile/avatar";
import { createClient } from "@/lib/supabase/server";

/**
 * Enveloppe des pages authentifiées.
 *
 * Le middleware protège déjà ces routes, mais on revérifie ici : c'est ce qui
 * garantit qu'un profil existe réellement avant que les pages enfants tentent
 * de le lire.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireUser();
  if (!auth) redirect("/login");

  // La mise en place (profil, transfert, parrainage) se fait dans la
  // présentation de bienvenue, par-dessus l'application : plus d'écran à part
  // qui bloque l'accès. Tant qu'elle n'est pas finie, elle revient à chaque
  // connexion ; le tableau de bord rappelle aussi de brancher la boîte mail.
  const cookieStore = await cookies();
  const session = readSession(cookieStore.get(SESSION_COOKIE)?.value);
  const bannerHidden = cookieStore.get(REFERRAL_BANNER_COOKIE)?.value === "1";
  const tourPending = !auth.profile.tour_completed_at;

  const supabase = await createClient();
  const [{ count: reviewCount }, { count: documentsUsed }, photo, domains] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("over_quota", false)
      .eq("confirmed_by_user", false)
      .lt("confidence", 0.7),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    avatarUrl(auth.profile.avatar_path),
    // Expéditeurs à transférer : seulement tant que la mise en place n'est
    // pas finie (présentation, ou boîte mail encore à brancher).
    tourPending || !auth.profile.gmail_forward_verified
      ? forwardingDomains()
      : Promise.resolve([] as string[]),
  ]);

  const { accent, background } = effectiveTheme(auth.profile);

  return (
    <div
      data-accent={accent}
      data-bg={background}
      className="flex min-h-dvh flex-col md:flex-row"
    >
      <Sidebar
        plan={auth.profile.plan}
        email={auth.profile.email}
        name={auth.profile.name}
        avatarUrl={photo}
        reviewCount={reviewCount ?? 0}
        documentsUsed={documentsUsed ?? 0}
        documentsLimit={PLAN_LIMITS[auth.profile.plan].documents}
      />
      <main className="min-w-0 flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">
        <div className="mx-auto w-full max-w-5xl">
          {!bannerHidden && <ReferralBanner />}
          {children}
        </div>
      </main>
      <WelcomeTour
        userId={auth.userId}
        email={auth.profile.email}
        name={auth.profile.name}
        avatarUrl={photo}
        address={inboxAddress(auth.profile)}
        domains={domains}
        initialConfirmation={
          auth.profile.gmail_confirmation as { code: string; url: string | null } | null
        }
        referralLink={`${siteUrl()}/p/${auth.profile.referral_code}`}
        completed={!tourPending}
        sessionKey={String(session?.issued ?? "")}
      />
    </div>
  );
}
