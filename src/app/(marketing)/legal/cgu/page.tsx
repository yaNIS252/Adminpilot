import type { Metadata } from "next";
import Link from "next/link";

import {
  Block,
  LegalLayout,
  ToComplete,
} from "@/components/marketing/legal-page";
import { LEGAL } from "@/lib/legal";
import { FAMILY_SEATS, PLAN_PRICES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Conditions d’utilisation — AdminPilot",
  description:
    "Conditions générales d’utilisation et de vente du service AdminPilot : objet, inscription, abonnements, responsabilité, résiliation.",
};

/**
 * Conditions générales d'utilisation et de vente.
 *
 * Rédigées à partir du fonctionnement réel du service. Ce n'est pas un modèle
 * générique : chaque clause décrit ce que le code fait vraiment.
 *
 * Elles doivent néanmoins être relues par un juriste avant l'ouverture au
 * public — notamment les clauses de responsabilité et de rétractation, où une
 * formulation approximative se retourne contre l'éditeur.
 */
export default function TermsPage() {
  return (
    <LegalLayout
      title="Conditions d’utilisation"
      intro="Ce que le service s’engage à faire, ce qu’il ne garantit pas, et comment y mettre fin."
      updated="24 septembre 2026"
      current="/legal/cgu"
    >
      <Block title="1. Objet">
        <p>
          AdminPilot est un service en ligne qui analyse les emails et documents
          que l’utilisateur lui transfère, afin d’en extraire ses abonnements,
          de l’alerter avant leurs échéances, de classer ses documents et de
          l’aider à rédiger des lettres de résiliation.
        </p>
        <p>
          L’utilisation du service implique l’acceptation des présentes
          conditions.
        </p>
      </Block>

      <Block title="2. Inscription">
        <p>
          L’inscription se fait par compte Google ou par lien envoyé par email.
          L’utilisateur garantit l’exactitude de l’adresse fournie et
          l’utilisation personnelle de son compte.
        </p>
        <p>
          Le service est réservé aux personnes majeures agissant pour leurs
          besoins propres, non professionnels.
        </p>
      </Block>

      <Block title="3. Formules et paiement">
        <p>
          La formule Gratuite est accessible sans limite de durée, dans les
          limites d’usage indiquées sur la page des tarifs. Les formules Pro
          ({PLAN_PRICES.pro.monthly} € par mois ou {PLAN_PRICES.pro.yearly} €
          par an) et Premium ({PLAN_PRICES.family.monthly} € par mois ou{" "}
          {PLAN_PRICES.family.yearly} € par an) sont payantes, sans engagement
          de durée.
        </p>
        <p>
          La formule Premium permet à son titulaire d’inviter jusqu’à{" "}
          {FAMILY_SEATS - 1} personnes, qui bénéficient des mêmes droits tant
          que l’abonnement est actif. Chaque compte reste distinct : aucun
          membre n’a accès aux documents ni aux abonnements d’un autre.
        </p>
        <p>
          Les paiements sont traités par Stripe. Aucune coordonnée bancaire ne
          transite par les serveurs d’AdminPilot. Les prix sont indiqués toutes
          taxes comprises en euros.
        </p>
        <p>
          L’abonnement se reconduit automatiquement à échéance. Il peut être
          résilié à tout moment depuis les réglages ; la résiliation prend effet
          à la fin de la période en cours, sans remboursement au prorata.
        </p>
      </Block>

      <Block title="4. Droit de rétractation">
        <p>
          Conformément à l’article L221-18 du Code de la consommation,
          l’utilisateur dispose de quatorze jours pour se rétracter d’un
          abonnement payant. En souscrivant, il demande l’exécution immédiate du
          service et reconnaît que ce droit s’éteint une fois le service
          pleinement exécuté.
        </p>
        <ToComplete>
          la relecture de cette clause par un juriste, ainsi que le formulaire
          de rétractation type.
        </ToComplete>
      </Block>

      <Block title="5. Ce que le service ne garantit pas">
        <p>
          L’extraction des données repose sur une analyse automatisée qui peut
          se tromper. AdminPilot affiche un niveau de confiance et marque « à
          vérifier » les détections incertaines, mais ne garantit ni
          l’exhaustivité ni l’exactitude des montants, périodicités et échéances
          détectés.
        </p>
        <p>
          <strong className="text-[var(--text)]">
            Il appartient à l’utilisateur de vérifier ces informations auprès de
            ses fournisseurs avant toute décision.
          </strong>{" "}
          Les alertes sont un confort, non une garantie : leur réception dépend
          de la remise du courrier électronique, que nous ne maîtrisons pas.
        </p>
      </Block>

      <Block title="6. Lettres de résiliation">
        <p>
          Les lettres générées citent la base légale correspondant au type de
          contrat renseigné. Elles constituent une aide à la rédaction et non un
          conseil juridique. AdminPilot n’est pas un cabinet d’avocats et ne
          procède à aucune démarche à la place de l’utilisateur : l’envoi, les
          délais et les preuves restent à sa charge.
        </p>
      </Block>

      <Block title="7. Comparateur d’offres">
        <p>
          Les comparaisons affichées sont fournies à titre informatif et ne
          constituent ni un conseil en assurance, ni une recommandation
          personnalisée, ni un acte d’intermédiation.
        </p>
        <p>
          Les offres sont classées par prix mensuel, sans autre critère.
          Certaines sont signalées comme « lien partenaire » : AdminPilot peut
          percevoir une commission si l’utilisateur souscrit par ce lien, sans
          surcoût pour lui et sans effet sur le classement. Aucun lien rémunéré
          n’est proposé pour les assurances ni les produits bancaires.
        </p>
      </Block>

      <Block title="8. Obligations de l’utilisateur">
        <p>
          L’utilisateur s’engage à ne transférer que des documents dont il est
          le destinataire légitime, à ne pas tenter d’accéder aux données
          d’autrui, et à ne pas perturber le fonctionnement du service.
        </p>
        <p>
          Des limites de débit s’appliquent afin de préserver le service. Un
          usage manifestement abusif peut entraîner la suspension du compte.
        </p>
      </Block>

      <Block title="9. Disponibilité">
        <p>
          Le service est fourni sans engagement de disponibilité. Des
          interruptions peuvent survenir pour maintenance ou du fait de nos
          prestataires techniques.
        </p>
      </Block>

      <Block title="10. Résiliation">
        <p>
          L’utilisateur peut supprimer son compte à tout moment depuis ses{" "}
          <Link href="/reglages">réglages</Link>. La suppression est définitive
          et emporte l’effacement de ses documents et données.
        </p>
        <p>
          L’éditeur peut résilier un compte en cas de manquement aux présentes
          conditions, après information de l’utilisateur.
        </p>
      </Block>

      <Block title="11. Données personnelles">
        <p>
          Le traitement des données est décrit dans la{" "}
          <Link href="/legal/confidentialite">
            politique de confidentialité
          </Link>
          , qui fait partie intégrante des présentes conditions.
        </p>
      </Block>

      <Block title="12. Droit applicable">
        <p>
          Les présentes conditions sont soumises au droit français. En cas de
          litige, l’utilisateur peut recourir gratuitement au médiateur de la
          consommation avant toute action judiciaire.
        </p>
        {LEGAL.mediator.name && LEGAL.mediator.website ? (
          <p>
            Médiateur de la consommation :{" "}
            <strong className="text-[var(--text)]">{LEGAL.mediator.name}</strong>
            {LEGAL.mediator.address && <>, {LEGAL.mediator.address}</>} —{" "}
            <a href={LEGAL.mediator.website} target="_blank" rel="noopener noreferrer">
              {LEGAL.mediator.website}
            </a>
            . La plateforme européenne de règlement en ligne des litiges reste
            également accessible.
          </p>
        ) : (
          <ToComplete>
            les coordonnées du médiateur de la consommation dont relève
            l’activité (à renseigner dans src/lib/legal.ts).
          </ToComplete>
        )}
      </Block>
    </LegalLayout>
  );
}
