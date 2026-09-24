import { DocumentGrid } from "@/components/dashboard/document-grid";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Documents — AdminPilot" };

export default async function DocumentsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="flex flex-col gap-5">
      <header className="anim-up">
        <h1 className="m-0 text-[26px] font-bold tracking-[-0.03em]">
          Documents
        </h1>
        <p className="m-0 mt-1 max-w-xl text-sm text-[var(--text-dim)]">
          Classés automatiquement, renommés pour être retrouvables. Les fichiers
          ne sont jamais accessibles publiquement.
        </p>
      </header>

      <DocumentGrid initial={data ?? []} />
    </div>
  );
}
