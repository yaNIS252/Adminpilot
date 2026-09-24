import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LEGAL_TEMPLATES } from "@/lib/cancel/templates";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Pages SEO « comment résilier X », générées depuis `known_providers`.
 *
 * Le contenu ne vient PAS d'un modèle : il est dérivé de données vérifiées à la
 * main (base légale, méthode, URL). Publier 200 pages juridiques générées sans
 * relecture serait à la fois un risque de désinformation et, pour Google, du
 * contenu de faible valeur produit à la chaîne.
 */

export const revalidate = 86400;

async function getProvider(slug: string) {
  const { data } = await createAdminClient()
    .from("known_providers")
    .select("*")
    .eq("seo_slug", slug)
    .maybeSingle();
  return data;
}

export async function generateStaticParams() {
  const { data } = await createAdminClient()
    .from("known_providers")
    .select("seo_slug");
  return (data ?? []).map((row) => ({ slug: row.seo_slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const provider = await getProvider((await params).slug);
  if (!provider) return {};

  const title = `Comment résilier ${provider.name} en 2026 — modèle de lettre`;
  const description = `Procédure de résiliation ${provider.name} : base légale applicable, méthode acceptée, délais à respecter et lettre type à télécharger.`;

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

const METHOD_LABELS = {
  courrier: "par courrier recommandé",
  email: "par email",
  en_ligne: "depuis ton espace client",
} as const;

export default async function CancelGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const provider = await getProvider((await params).slug);
  if (!provider) notFound();

  const legal = LEGAL_TEMPLATES[provider.legal_basis];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <article>
        <h1 className="mb-2 text-3xl font-bold tracking-tight">
          Comment résilier {provider.name}
        </h1>
        <p className="mb-8 text-[var(--text-dim)]">
          {provider.cancel_method
            ? `La résiliation se fait ${METHOD_LABELS[provider.cancel_method]}.`
            : "La procédure dépend de ton contrat."}
        </p>

        <Block title="Le cadre légal">
          <p className="m-0 mb-2">
            <strong>{legal.label}</strong> — {legal.article}.
          </p>
          <p className="m-0 text-[var(--text-dim)]">{legal.timing}</p>
        </Block>

        <Block title="La marche à suivre">
          <ol className="m-0 space-y-2 pl-5">
            <li>
              Rassemble ta référence de contrat : elle figure sur tes factures
              et sur ton espace client.
            </li>
            <li>
              Rédige ta demande en citant la base légale ci-dessus. C’est ce qui
              distingue une résiliation opposable d’une simple demande.
            </li>
            {provider.cancel_method === "courrier" ? (
              <li>
                Envoie-la en recommandé avec accusé de réception. Sans preuve de
                réception, la date de résiliation est contestable.
              </li>
            ) : (
              <li>
                Conserve une preuve horodatée : capture d’écran, accusé de
                réception ou copie de l’email envoyé.
              </li>
            )}
            <li>
              Vérifie l’arrêt effectif des prélèvements sur les deux mois
              suivants. C’est l’étape que tout le monde oublie.
            </li>
          </ol>
        </Block>

        {provider.cancel_url && (
          <Block title="Résiliation en ligne">
            <a
              href={provider.cancel_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-[var(--accent)]"
            >
              Espace client {provider.name}
            </a>
          </Block>
        )}

        <div className="mt-8 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--accent-soft)] p-5">
          <h2 className="mt-0 mb-2 text-base font-semibold">
            Fais-le en une minute
          </h2>
          <p className="m-0 mb-3 text-sm">
            AdminPilot repère tes abonnements dans tes emails, t’alerte avant
            chaque reconduction et génère la lettre conforme à ta place.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white no-underline"
          >
            Essayer gratuitement
          </Link>
        </div>

        <p className="mt-8 text-xs text-[var(--text-dim)]">
          Information générale, sans valeur de conseil juridique. Vérifie les
          conditions particulières de ton contrat.
        </p>
      </article>
    </main>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
