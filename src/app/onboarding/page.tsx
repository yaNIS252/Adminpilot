import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/wizard";
import { inboxAddress, requireUser } from "@/lib/auth/require-user";

export const metadata = { title: "Configuration — AdminPilot" };

export default async function OnboardingPage() {
  const auth = await requireUser();
  if (!auth) redirect("/login");
  if (auth.profile.gmail_forward_verified) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
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
  );
}
