import type { Metadata } from "next";
import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Guides de résiliation — AdminPilot",
  description:
    "Comment résilier vos abonnements énergie, télécom, streaming, assurance ou banque : base légale, procédure et délais, fournisseur par fournisseur.",
};

/**
 * Index des guides de résiliation.
 *
 * Sans cette page, les 52 guides sont orphelins : aucun lien interne n'y mène,
 * donc ni un visiteur ni un robot d'indexation ne peut les découvrir. C'est ce
 * qui transforme 52 pages isolées en une arborescence que Google parcourt.
 */

const CATEGORY_LABELS: Record<string, string> = {
  energie: "Énergie",
  telecom: "Télécom",
  streaming: "Streaming",
  assurance: "Assurance",
  banque: "Banque",
  logement: "Logement",
  transport: "Transport",
  logiciel: "Services et logiciels",
};

export default async function CancelIndexPage() {
  const { data } = await createAdminClient()
    .from("known_providers")
    .select("name, seo_slug, category")
    .order("name");

  const byCategory = new Map<string, typeof data>();
  for (const provider of data ?? []) {
    const list = byCategory.get(provider.category) ?? [];
    list.push(provider);
    byCategory.set(provider.category, list);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">
        Guides de résiliation
      </h1>
      <p className="mb-10 text-[var(--text-dim)]">
        La base légale applicable, la procédure acceptée et les délais à
        respecter, fournisseur par fournisseur.
      </p>

      {[...byCategory.entries()].map(([category, providers]) => (
        <section key={category} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold tracking-tight">
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-1 p-0 sm:grid-cols-3">
            {(providers ?? []).map((provider) => (
              <li key={provider.seo_slug}>
                <Link
                  href={`/resilier/${provider.seo_slug}`}
                  className="text-sm text-[var(--text-dim)] no-underline hover:text-[var(--accent)]"
                >
                  {provider.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="mt-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--accent-soft)] p-5">
        <h2 className="mt-0 mb-2 text-base font-semibold">
          Et si tu n’avais rien à chercher ?
        </h2>
        <p className="m-0 mb-3 text-sm">
          AdminPilot repère tes abonnements dans tes emails, t’alerte avant
          chaque reconduction et prépare la lettre à ta place.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white no-underline"
        >
          Essayer gratuitement
        </Link>
      </div>
    </main>
  );
}
