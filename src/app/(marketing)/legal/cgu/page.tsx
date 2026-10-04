import type { Metadata } from "next";
import Link from "next/link";

import {
  Block,
  LegalLayout,
  ToComplete,
} from "@/components/marketing/legal-page";
import { LEGAL } from "@/lib/legal";
import { FAMILY_SEATS, PLAN_PRICES, REFERRAL } from "@/lib/constants";

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
      updated="4 octobre 2026"
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
          L’inscription se fait par un lien de connexion envoyé par e-mail,
          sans mot de passe.
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
          résilié à tout moment, en ligne, depuis le bouton « Résilier mon
          abonnement » des réglages. La résiliation prend effet à la fin de la
          période déjà payée, sans remboursement au prorata hors exercice du
          droit de rétractation ; l’utilisateur en reçoit la confirmation par
          e-mail, avec sa date d’effet.
        </p>
        <p>
          Pour les formules annuelles, un rappel est adressé par e-mail avant
          chaque renouvellement, rappelant la possibilité de ne pas le
          reconduire.
        </p>
        <p>
          Toute évolution des prix est annoncée par e-mail au moins un mois
          avant de s’appliquer. Elle ne concerne que les périodes suivantes, et
          l’utilisateur peut résilier avant son entrée en vigueur.
        </p>
      </Block>

      <Block title="4. Droit de rétractation">
        <p>
          Conformément à l’article L221-18 du Code de la consommation,
          l’utilisateur dispose de quatorze jours à compter de la souscription
          pour se rétracter d’un abonnement payant, sans avoir à se justifier.
        </p>
        <p>
          Au moment du paiement, l’utilisateur demande expressément à
          bénéficier du service avant la fin de ce délai. S’il se rétracte
          ensuite dans les quatorze jours, il est remboursé de la somme payée,
          déduction faite du prix des jours écoulés jusqu’à sa rétractation
          (article L221-25), sous quatorze jours et par le moyen de paiement
          utilisé.
        </p>
        <p>
          Pour se rétracter, il suffit d’adresser une déclaration dénuée
          d’ambiguïté par e-mail
          {LEGAL.contactEmail ? <> à {LEGAL.contactEmail}</> : null}, par
          exemple au moyen du modèle ci-dessous.
        </p>
        <blockquote className="m-0 border-l-2 border-[var(--border-strong)] pl-4 text-[14px]">
          À l’attention de {LEGAL.editorName ?? "[nom de l’éditeur]"},{" "}
          {LEGAL.address ?? "[adresse]"}
          {LEGAL.contactEmail ? <>, {LEGAL.contactEmail}</> : null} :<br />
          Je vous notifie par la présente ma rétractation du contrat portant sur
          l’abonnement AdminPilot ci-dessous.
          <br />
          Souscrit le : … · Nom : … · Adresse e-mail du compte : …
          <br />
          Date : … · Signature (en cas d’envoi papier)
        </blockquote>
        <ToComplete>
          la relecture de cette clause par un juriste avant l’ouverture au
          public.
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

      <Block title="8. Parrainage">
        <p>
          Chaque utilisateur dispose d’un lien de parrainage personnel. Une
          personne qui crée son compte par ce lien (le « filleul ») reçoit{" "}
          {REFERRAL.bonusDays} jours de formule Pro, sans paiement ni carte
          bancaire, dès que le transfert de ses e-mails vers AdminPilot
          fonctionne. À l’issue de cette période, le compte revient à la
          formule gratuite sauf souscription d’un abonnement ; un abonnement
          souscrit pendant la période offerte ne donne lieu à aucun
          prélèvement avant son terme.
        </p>
        <p>
          Le parrain reçoit {REFERRAL.bonusDays} jours de formule Pro lorsque
          le filleul compte au moins {REFERRAL.minSubscriptions} abonnements
          détectés à partir d’e-mails transférés et un compte ouvert depuis au
          moins {REFERRAL.minAgeDays} jours, ou dès que le filleul souscrit un
          abonnement payant. Un parrain déjà abonné reçoit à la place un
          crédit égal à un mois de formule Pro, déduit de ses prochaines
          factures. Les avantages se cumulent dans la limite de{" "}
          {REFERRAL.maxMonths} mois par parrain. Ils ne sont ni échangeables
          ni remboursables en argent.
        </p>
        <p>
          Le parrainage est réservé à des personnes distinctes. Ne donnent lieu
          à aucun avantage : le parrainage de soi-même, y compris par une autre
          adresse e-mail ou une autre boîte de réception que l’on contrôle ;
          le parrainage entre membres d’un même foyer Premium ; un compte
          alimenté par une boîte de réception déjà utilisée par un autre
          compte ; les inscriptions en série depuis une même connexion ; un
          paiement effectué avec un moyen de paiement du parrain. AdminPilot
          procède à des vérifications automatiques à cette fin. Tant qu’un
          parrainage n’est pas validé, il apparaît « en attente de
          validation » ; l’utilisateur peut nous écrire pour en connaître la
          raison.
        </p>
        <p>
          L’éditeur peut modifier ou arrêter le programme de parrainage à tout
          moment, pour l’avenir : les avantages déjà accordés restent acquis.
        </p>
      </Block>

      <Block title="9. Obligations de l’utilisateur">
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

      <Block title="10. Disponibilité">
        <p>
          Le service est fourni sans engagement de disponibilité. Des
          interruptions peuvent survenir pour maintenance ou du fait de nos
          prestataires techniques.
        </p>
      </Block>

      <Block title="11. Résiliation">
        <p>
          L’utilisateur peut supprimer son compte à tout moment depuis ses{" "}
          <Link href="/reglages">réglages</Link>. La suppression est définitive,
          emporte l’effacement de ses documents et données et met fin à
          l’abonnement payant éventuel.
        </p>
        <p>
          L’éditeur peut résilier un compte en cas de manquement aux présentes
          conditions, après information de l’utilisateur.
        </p>
      </Block>

      <Block title="12. Données personnelles">
        <p>
          Le traitement des données est décrit dans la{" "}
          <Link href="/legal/confidentialite">
            politique de confidentialité
          </Link>
          , qui fait partie intégrante des présentes conditions.
        </p>
      </Block>

      <Block title="13. Droit applicable">
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
            .
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
