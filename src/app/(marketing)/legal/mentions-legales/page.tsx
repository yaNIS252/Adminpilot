import type { Metadata } from "next";

import {
  Block,
  LegalLayout,
  ToComplete,
} from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Mentions légales — AdminPilot",
  description:
    "Éditeur, hébergeur et informations légales du service AdminPilot.",
};

/**
 * Mentions légales — obligatoires pour tout site professionnel français
 * (article 6 III de la LCEN).
 *
 * Les informations d'identification de l'éditeur ne peuvent pas être devinées :
 * elles sont signalées comme à compléter, de façon visible. Mettre en ligne des
 * mentions incomplètes est une infraction, et inventer un SIREN serait pire que
 * de laisser le champ vide.
 */
export default function LegalNoticePage() {
  return (
    <LegalLayout
      title="Mentions légales"
      intro="Qui édite ce service, qui l’héberge, et comment nous joindre."
      updated="24 septembre 2026"
      current="/legal/mentions-legales"
    >
      <Block title="Éditeur du service">
        <ToComplete>
          nom et prénom de l’entrepreneur individuel, adresse du siège, numéro
          SIREN, numéro de TVA intracommunautaire le cas échéant, adresse email
          et numéro de téléphone de contact.
        </ToComplete>
        <p>
          Ces mentions sont obligatoires pour tout service en ligne
          professionnel, en application de l’article 6 III de la loi pour la
          confiance dans l’économie numérique. Un site ouvert au public sans
          elles expose son éditeur à des sanctions.
        </p>
      </Block>

      <Block title="Directeur de la publication">
        <ToComplete>
          nom du directeur de la publication, généralement l’entrepreneur
          lui-même.
        </ToComplete>
      </Block>

      <Block title="Hébergement">
        <p>
          L’application est hébergée par{" "}
          <strong className="text-[var(--text)]">Vercel Inc.</strong>, 440 N
          Barranca Ave #4133, Covina, CA 91723, États-Unis.
        </p>
        <p>
          Les données applicatives sont hébergées par{" "}
          <strong className="text-[var(--text)]">Supabase</strong> dans
          l’Union européenne, et le service de messagerie est assuré par{" "}
          <strong className="text-[var(--text)]">Resend</strong>, également dans
          l’Union européenne.
        </p>
      </Block>

      <Block title="Propriété intellectuelle">
        <p>
          L’ensemble des contenus de ce site — textes, interface, code — est
          protégé par le droit d’auteur. Toute reproduction sans autorisation
          est interdite.
        </p>
        <p>
          Les marques et dénominations des fournisseurs cités dans les guides de
          résiliation appartiennent à leurs titulaires respectifs. AdminPilot
          est un service indépendant, sans lien avec eux, et leur mention est
          faite à titre purement informatif.
        </p>
      </Block>

      <Block title="Activité réglementée">
        <p>
          AdminPilot n’exerce aucune activité d’intermédiation en assurance ni
          en opérations de banque. Les informations fournies sur les contrats et
          les procédures de résiliation ont une valeur documentaire et ne
          constituent pas un conseil juridique ou financier personnalisé.
        </p>
      </Block>

      <Block title="Signaler un contenu">
        <ToComplete>
          l’adresse à laquelle adresser un signalement de contenu illicite.
        </ToComplete>
      </Block>
    </LegalLayout>
  );
}
