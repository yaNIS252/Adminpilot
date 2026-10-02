import { DocumentGrid } from "@/components/dashboard/document-grid";
import { DocumentSearch } from "@/components/dashboard/document-search";
import { requireUser } from "@/lib/auth/require-user";
import { PLAN_LIMITS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Documents — AdminPilot" };

export default async function DocumentsPage() {
  const auth = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="flex flex-col gap-5">
      <header className="anim-up">
        <h1 className="serif m-0 text-[36px] leading-[1.05]">
          Documents
        </h1>
        <p className="m-0 mt-1 max-w-xl text-sm text-[var(--text-dim)]">
          Classés automatiquement, renommés pour être retrouvables. Les fichiers
          ne sont jamais accessibles publiquement.
        </p>
      </header>

      <DocumentSearch
        locked={!auth || PLAN_LIMITS[auth.profile.plan].searches === 0}
      />

      <DocumentGrid initial={data ?? []} />
    </div>
  );
}
