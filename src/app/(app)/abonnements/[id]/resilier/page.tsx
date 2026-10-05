import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, Globe, Lock, Scale } from "lucide-react";

import { CategoryTip, GuideSteps } from "@/components/cancel/cancel-guide";
import { LetterForm } from "@/components/cancel/letter-form";
import { OfferList } from "@/components/cancel/offer-list";
import { LetterTracker } from "@/components/cancel/letter-tracker";
import { ProviderAvatar } from "@/components/shared/provider-avatar";
import { requireUser } from "@/lib/auth/require-user";
import { parseGuide } from "@/lib/cancel/guides";
import { trustedLink } from "@/lib/cancel/links";
import { LEGAL_TEMPLATES } from "@/lib/cancel/templates";
import { readUuid } from "@/lib/http/request";
import { formatAmount, formatCycle, formatDate, monthlyEquivalent } from "@/lib/format";
import { compareOffers } from "@/lib/offers";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export const metadata = { title: "Résilier — AdminPilot" };

/**
 * Résiliation d'un abonnement, dans l'ordre où elle coûte le moins d'effort :
 *  1. le lien de résiliation en ligne, quand on en connaît un — ouvert à tous ;
 *  2. la lettre, prête à imprimer — formules payantes ;
 *  3. le suivi : envoyée, puis confirmée, ce qui retire l'abonnement du total.
 */
export default async function CancelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = readUuid((await params).id);
  if (!id) notFound();

  const auth = await requireUser();
  if (!auth) notFound();

  const supabase = await createClient();
  const [{ data: sub }, { data: letter }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "id, provider, amount, currency, cycle, category, next_renewal, status, metadata, known_providers(name, domain, category, seo_slug, cancel_method, cancel_url, cancel_address, cancel_guide, legal_basis)",
      )
      .eq("id", id)
      .eq("over_quota", false)
      .maybeSingle(),
    supabase
      .from("cancellations")
      .select("id, status, sent_at, created_at, template_used")
      .eq("subscription_id", id)
      .maybeSingle(),
  ]);
  if (!sub) notFound();

  // L'abonnement AdminPilot se résilie depuis les réglages, en un clic.
  const meta = sub.metadata && typeof sub.metadata === "object" && !Array.isArray(sub.metadata) ? sub.metadata : {};
  if ((meta as Record<string, unknown>).source === "adminpilot_billing") redirect("/reglages#formules");

  const catalogue = sub.known_providers as unknown as {
    name: string;
    domain: string;
    seo_slug: string;
    cancel_method: "courrier" | "email" | "en_ligne" | null;
    cancel_url: string | null;
    cancel_address: string | null;
    category: string;
    cancel_guide: Json | null;
    legal_basis: keyof typeof LEGAL_TEMPLATES;
  } | null;

  const basis = catalogue?.legal_basis ?? "libre";
  const template = LEGAL_TEMPLATES[basis];
  const name = catalogue?.name ?? sub.provider;

  // Lien officiel du catalogue d'abord (vérifié à la main), sinon celui trouvé
  // dans les e-mails. Ce dernier n'a été enregistré qu'après contrôle de son
  // domaine à l'ingestion, et `metadata` n'est pas modifiable par
  // l'utilisateur (migration 0010) : on ne revérifie ici que le protocole.
  const metadata =
    sub.metadata && typeof sub.metadata === "object" && !Array.isArray(sub.metadata)
      ? (sub.metadata as Record<string, unknown>)
      : {};
  const emailUrl = typeof metadata.manage_url === "string" ? metadata.manage_url : null;
  const siteUrl = typeof metadata.site_url === "string" ? metadata.site_url : null;
  const directUrl =
    // Le catalogue est vérifié à la main : son lien peut vivre sur un autre
    // domaine que celui des e-mails (espace client séparé).
    trustedLink(catalogue?.cancel_url, [hostOf(catalogue?.cancel_url ?? null)]) ??
    trustedLink(emailUrl, [hostOf(emailUrl)]);
  // À défaut de lien de gestion, le site du fournisseur : on y trouve
  // l'espace client. Domaine du catalogue ou de l'expéditeur des factures.
  const homeUrl = directUrl
    ? null
    : trustedLink(siteUrl, [hostOf(siteUrl)]) ??
      (catalogue?.domain ? `https://www.${catalogue.domain.replace(/^www\./, "")}` : null);
  const onlineUrl = directUrl ?? homeUrl;
  const onlineHost = onlineUrl ? new URL(onlineUrl).hostname.replace(/^www\./, "") : null;
  const fromEmail = !catalogue?.cancel_url && Boolean(directUrl);

  const guide = parseGuide(catalogue?.cancel_guide);
  const category = catalogue?.category ?? sub.category;
  const currentMonthly = monthlyEquivalent(sub.amount, sub.cycle);
  const { data: catalogueOffers } =
    category && currentMonthly > 0
      ? await supabase
          .from("offers")
          .select("id, provider_name, name, monthly_price, conditions, url, affiliate_url, checked_at, category, valid_until")
          .eq("category", category)
          .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString().slice(0, 10)}`)
          .order("monthly_price")
          .limit(20)
      : { data: [] };
  const offers = compareOffers(catalogueOffers ?? [], {
    currentMonthly,
    currentProvider: name,
  });
  const paid = auth.profile.plan !== "free";
  const cancelled = sub.status === "cancelled";

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/abonnements"
        className="anim-up inline-flex items-center gap-1.5 self-start text-[13px] text-[var(--text-dim)] no-underline hover:text-[var(--text)]"
      >
        <ArrowLeft className="size-4" />
        Abonnements
      </Link>

      <header className="anim-up flex flex-wrap items-center gap-4">
        <ProviderAvatar name={sub.provider} size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="serif m-0 text-[34px] leading-[1.05]">
            Résilier <em>{name}</em>
          </h1>
          <p className="m-0 mt-1 text-sm text-[var(--text-dim)]">
            {[
              formatAmount(sub.amount, sub.currency),
              formatCycle(sub.cycle),
              sub.next_renewal ? `prochaine échéance le ${formatDate(sub.next_renewal)}` : null,
              typeof metadata.commitment_end === "string"
                ? `engagement jusqu’au ${formatDate(metadata.commitment_end)}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Montant et échéance inconnus"}
          </p>
        </div>
      </header>

      {cancelled && (
        <p
          role="status"
          className="m-0 rounded-[10px] border border-[rgba(63,207,149,.35)] bg-[rgba(63,207,149,.06)] px-5 py-4 text-sm"
        >
          Résiliation confirmée. Cet abonnement ne compte plus dans tes
          dépenses et n’a plus de rappel programmé. Surveille tout de même tes
          deux prochains relevés : l’arrêt effectif des prélèvements est l’étape
          que tout le monde oublie.
        </p>
      )}

      {!cancelled && <CategoryTip category={catalogue?.category ?? sub.category} />}

      <Card icon={<Globe className="size-4" />} title="En ligne, le plus rapide">
        {onlineUrl ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm text-[var(--text-dim)]">
              {homeUrl
                ? `Pas de lien direct de résiliation connu : voici le site de ${name}. Connecte-toi à ton espace client, rubrique abonnement ou contrat, puis suis la procédure jusqu’à la confirmation.`
                : `${
                    fromEmail
                      ? `Lien de gestion trouvé dans un e-mail de ${name}.`
                      : `Page officielle de résiliation de ${name}.`
                  } Connecte-toi à ton compte, puis suis la procédure jusqu’à la confirmation.`}
            </p>
            <a
              href={onlineUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn-primary h-10 self-start px-4 text-sm"
            >
              Ouvrir {onlineHost}
              <ExternalLink className="size-4" />
            </a>
            <p className="m-0 text-xs text-[var(--text-faint)]">
              Tu quittes AdminPilot. Vérifie que la barre d’adresse affiche bien{" "}
              <strong className="text-[var(--text-dim)]">{onlineHost}</strong>{" "}
              avant de saisir tes identifiants. Garde une capture de la
              confirmation : c’est ta preuve.
            </p>
            {guide && (
              <div className="mt-1 border-t border-[var(--border-soft)] pt-3.5">
                <div className="mb-2 text-[13px] font-medium">Étape par étape</div>
                <GuideSteps guide={guide} />
              </div>
            )}
          </div>
        ) : guide ? (
          <GuideSteps guide={guide} />
        ) : (
          <p className="m-0 text-sm text-[var(--text-dim)]">
            Pas de lien de résiliation connu pour {name}.
            {catalogue?.cancel_method === "en_ligne"
              ? " Elle se fait depuis ton espace client, rubrique abonnement ou contrat."
              : " La lettre ci-dessous fonctionne dans tous les cas."}{" "}
            Si un e-mail de {name} contient un lien « gérer mon abonnement »,
            transfère-le : il apparaîtra ici.
          </p>
        )}
      </Card>

      {!cancelled && <OfferList offers={offers} category={category} />}

      <Card icon={<Scale className="size-4" />} title={`Ce que dit la loi · ${template.label}`}>
        <p className="m-0 text-sm text-[var(--text-dim)]">{template.timing}</p>
        {!catalogue && (
          <p className="m-0 mt-2 text-xs text-[var(--text-faint)]">
            {name} n’est pas encore dans notre catalogue vérifié : la lettre
            s’appuie sur tes conditions générales, sans citer de loi qui
            pourrait ne pas s’appliquer.
          </p>
        )}
        {catalogue && (
          <Link
            href={`/resilier/${catalogue.seo_slug}`}
            className="mt-2 inline-block text-xs"
          >
            Guide complet pour résilier {name}
          </Link>
        )}
      </Card>

      <Card icon={<FileText className="size-4" />} title="Par lettre">
        {letter && (
          <LetterTracker
            id={letter.id}
            status={letter.status}
            sentAt={letter.sent_at}
            provider={name}
          />
        )}

        {paid ? (
          !cancelled && (
            <LetterForm
              subscriptionId={sub.id}
              provider={name}
              defaultName={auth.profile.name ?? ""}
              recipientAddress={catalogue?.cancel_address ?? ""}
              regenerate={Boolean(letter)}
              registered={catalogue?.cancel_method !== "en_ligne"}
            />
          )
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <Lock className="size-5 shrink-0 text-[var(--accent-lighter)]" />
            <p className="m-0 min-w-[220px] flex-1 text-sm text-[var(--text-dim)]">
              Avec <strong className="text-[var(--text)]">Pro</strong>, ta lettre
              de résiliation est prête en trente secondes : base légale
              exacte, mise en page conforme, PDF à imprimer.
            </p>
            <Link href="/reglages?formule=pro#formules" className="btn-primary h-10 px-4 text-[13px]">
              Passer Pro
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-sheen anim-up rounded-[var(--radius-xl)] border border-[var(--border)] p-5">
      <h2 className="mt-0 mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <span className="text-[var(--accent-light)]">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
