import { DocumentGrid } from "@/components/dashboard/document-grid";
import { DocumentSearch } from "@/components/dashboard/document-search";
import { PendingDocuments, type PendingDocument } from "@/components/dashboard/pending-documents";
import { normalizeProvider } from "@/lib/ingest/pipeline";
import { requireUser } from "@/lib/auth/require-user";
import { PLAN_LIMITS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Documents — AdminPilot" };

export default async function DocumentsPage() {
  const auth = await requireUser();
  const supabase = await createClient();

  const [{ data }, { data: waiting }, { data: subscriptions }] = await Promise.all([
    supabase
      .from("documents")
      .select("*")
      .is("pending_until", null)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("documents")
      .select("id, filename_ai, filename_original, extracted_data, pending_until")
      .not("pending_until", "is", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("subscriptions").select("provider").eq("status", "active"),
  ]);

  // Fournisseurs déjà suivis : pas de proposition « Suivre comme abonnement ».
  const followed = new Set((subscriptions ?? []).map((sub) => normalizeProvider(sub.provider)));
  const pending: PendingDocument[] = (waiting ?? []).map((doc) => {
    const extracted = (doc.extracted_data ?? {}) as Record<string, unknown>;
    const provider = typeof extracted.provider === "string" ? extracted.provider : null;
    const amount = typeof extracted.amount === "number" ? extracted.amount : null;
    const cycle = typeof extracted.billing_cycle === "string" ? extracted.billing_cycle : null;
    return {
      id: doc.id,
      name: doc.filename_ai ?? doc.filename_original,
      provider,
      amount,
      currency: typeof extracted.currency === "string" ? extracted.currency : "EUR",
      date: typeof extracted.document_date === "string" ? extracted.document_date : null,
      cycle,
      pendingUntil: doc.pending_until!,
      canTrack:
        Boolean(provider) &&
        amount !== null &&
        ["monthly", "yearly", "quarterly", "weekly"].includes(cycle ?? "") &&
        !followed.has(normalizeProvider(provider!)),
    };
  });

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

      <PendingDocuments items={pending} />

      <DocumentSearch
        locked={!auth || PLAN_LIMITS[auth.profile.plan].searches === 0}
      />

      <DocumentGrid initial={data ?? []} />
    </div>
  );
}
