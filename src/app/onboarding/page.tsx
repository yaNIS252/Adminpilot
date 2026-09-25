import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoMark } from "@/components/marketing/logo-mark";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { inboxAddress, requireUser } from "@/lib/auth/require-user";

export const metadata = { title: "Configuration — AdminPilot" };

export default async function OnboardingPage() {
  const auth = await requireUser();
  if (!auth) redirect("/login");
  if (auth.profile.gmail_forward_verified) redirect("/dashboard");

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <header className="border-b border-[var(--border-soft)]">
        <div className="mx-auto flex h-16 max-w-[640px] items-center px-5">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[var(--text-bright)] hover:text-[var(--text-bright)]"
          >
            <LogoMark />
            <span className="text-[15px] font-semibold tracking-[-0.01em]">
              AdminPilot
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[640px] px-5 pt-14 pb-20">
        <OnboardingWizard
        userId={auth.userId}
        address={inboxAddress(auth.profile)}
        initialConfirmation={
          auth.profile.gmail_confirmation as {
            code: string;
            url: string | null;
          } | null
        }
        />
      </main>
    </div>
  );
}
