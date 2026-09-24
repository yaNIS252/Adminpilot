import { redirect } from "next/navigation";

import { Sidebar } from "@/components/shared/sidebar";
import { requireUser } from "@/lib/auth/require-user";
import { PLAN_LIMITS } from "@/lib/constants";
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

  // Tant que le transfert n'est pas confirmé, l'application est vide de sens :
  // aucun email n'arrive. On renvoie vers l'onboarding plutôt que d'afficher
  // un tableau de bord désert que l'utilisateur prendrait pour une panne.
  if (!auth.profile.gmail_forward_verified) redirect("/onboarding");

  const supabase = await createClient();
  const [{ count: reviewCount }, { count: documentsUsed }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("confirmed_by_user", false)
      .lt("confidence", 0.7),
    supabase.from("documents").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar
        plan={auth.profile.plan}
        email={auth.profile.email}
        name={auth.profile.name}
        reviewCount={reviewCount ?? 0}
        documentsUsed={documentsUsed ?? 0}
        documentsLimit={PLAN_LIMITS[auth.profile.plan].documents}
      />
      <main className="min-w-0 flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
