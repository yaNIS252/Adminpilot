import type { Metadata } from "next";
import Link from "next/link";

import {
  Block,
  LegalLayout,
  ToComplete,
} from "@/components/marketing/legal-page";
import { LEGAL } from "@/lib/legal";
import { RAW_RETENTION_DAYS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Confidentialité — AdminPilot",
  description:
    "Quelles données AdminPilot traite, combien de temps elles sont conservées, qui y a accès, et comment les exporter ou les supprimer.",
};

/**
 * Politique de confidentialité.
 *
 * Décrit le comportement réel du système, pas une intention : durée de
 * rétention, sous-traitants, droits. Toute évolution du code qui change ce
 * comportement doit se refléter ici — une politique fausse est pire qu'une
 * politique absente, parce qu'elle engage.
 */
export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Confidentialité"
      intro="Ce que le service fait de tes données, décrit tel que le code le fait."
      updated="2 octobre 2026"
      current="/legal/confidentialite"
    >
      <Block title="1. Ce que nous recevons">
        <p>
          AdminPilot ne se connecte pas à ta boîte mail et n’en détient aucun
          mot de passe ni jeton d’accès. Le service reçoit uniquement les
          messages que tu transfères volontairement à ton adresse d’ingestion
          personnelle, ainsi que les documents que tu déposes toi-même.
        </p>
        <p>
          Ces messages peuvent contenir des données personnelles : nom, adresse
          postale, références de contrat, montants. Tu restes maître de ce que
          tu transfères.
        </p>
      </Block>

      <Block title="2. Ce que nous en extrayons">
        <p>
          Chaque message ou document est analysé pour en tirer des données
          structurées : fournisseur, montant, périodicité, date d’échéance,
          catégorie, référence de contrat. Ce sont ces données, et non le
          document d’origine, qui alimentent ton tableau de bord.
        </p>
        <p>
          Lorsque l’analyse n’est pas sûre d’elle, la donnée est marquée « à
          vérifier » plutôt que présentée comme un fait, et ne déclenche aucune
          alerte tant que tu ne l’as pas confirmée.
        </p>
      </Block>

      <Block title="3. Combien de temps nous les conservons">
        <p>
          Les emails bruts sont supprimés de notre stockage{" "}
          <strong>{RAW_RETENTION_DAYS} jours</strong> après leur analyse. Cette
          fenêtre existe pour pouvoir rejouer une extraction ratée ; passé ce
          délai, le message d’origine n’existe plus.
        </p>
        <p>
          Les documents que tu déposes toi-même t’appartiennent et restent dans
          ton espace jusqu’à ce que tu les supprimes. Les données extraites, les
          lettres de résiliation générées, ta photo de profil et tes
          préférences sont conservées tant que ton compte est actif, et
          effacées avec lui.
        </p>
        <p>
          Une invitation au foyer Premium contient l’adresse e-mail de la
          personne invitée, saisie par le titulaire pour lui envoyer
          l’invitation. Elle expire au bout de 14 jours et disparaît dès que
          l’invitation est annulée ou que le titulaire supprime son compte.
        </p>
        <p>
          Un e-mail qui ne concerne ni un abonnement ni une facture
          (newsletter, message personnel transféré par erreur) est effacé dès
          son analyse, sans attendre ce délai. Les codes de connexion et
          alertes de sécurité sont refusés à la réception, sans être stockés
          ni lus. Le filtre Gmail que nous proposons ne vise que les adresses
          d’envoi des fournisseurs connus ; l’option qui ajoute les e-mails
          dont l’objet parle de facture est désactivée par défaut.
        </p>
        <p>
          Pour le parrainage, nous conservons le lien entre parrain et filleul
          tant que leurs comptes existent, ainsi qu’une empreinte chiffrée
          (non réversible) de l’adresse IP d’inscription du filleul pendant
          30 jours, et une empreinte chiffrée de l’adresse e-mail qui
          transfère ses messages. Elles servent uniquement à repérer les
          inscriptions abusives (comptes multiples d’une même personne) ;
          aucune adresse n’est conservée en clair à cette fin. Le parrain ne
          voit de ses filleuls que leur prénom et l’état de leur
          parrainage.
        </p>
        <p>
          Les clics vers une offre du comparateur sont enregistrés pour
          rapprocher les éventuelles commissions de nos partenaires ; ils ne
          sont plus rattachés à toi dès la suppression de ton compte. Les
          factures de ton abonnement sont conservées par Stripe pendant la
          durée imposée par les obligations comptables (dix ans).
        </p>
      </Block>

      <Block title="4. Qui peut y accéder">
        <p>
          Chaque donnée est rattachée à ton compte et isolée au niveau de la
          base de données elle-même : une requête portant sur le compte d’un
          autre utilisateur ne renvoie rien, même en cas d’erreur applicative.
        </p>
        <p>
          Les fichiers ne sont jamais accessibles publiquement. Leur
          consultation passe par des liens signés valables une heure.
        </p>
      </Block>

      <Block title="5. Les services que nous utilisons">
        <p>
          Ces sous-traitants traitent des données pour notre compte, dans le
          cadre du service :
        </p>
        <ul className="m-0 space-y-1.5 pl-5">
          <li>
            <strong className="text-[var(--text)]">Supabase</strong> — base de
            données, authentification, stockage des fichiers. Hébergement dans
            l’Union européenne.
          </li>
          <li>
            <strong className="text-[var(--text)]">Resend</strong> — réception
            des emails transférés et envoi des alertes. Hébergement dans
            l’Union européenne.
          </li>
          <li>
            <strong className="text-[var(--text)]">Mistral AI</strong> (France)
            — analyse du contenu des messages et documents, hébergement dans
            l’Union européenne. Les données ne sont pas utilisées pour
            entraîner de modèle.
          </li>
          <li>
            <strong className="text-[var(--text)]">Vercel</strong> — hébergement
            de l’application.
          </li>
          <li>
            <strong className="text-[var(--text)]">Stripe</strong> — paiements.
            Aucune coordonnée bancaire ne transite par nos serveurs ni n’y est
            stockée.
          </li>
          <li>
            <strong className="text-[var(--text)]">Sentry</strong> — détection
            des erreurs techniques, lorsqu’elle est activée. Les rapports ne
            contiennent ni cookies, ni contenu de formulaire, ni adresse e-mail.
          </li>
        </ul>
        <p>
          Vercel, Stripe et Sentry sont des sociétés américaines : les
          transferts de données vers les États-Unis qu’ils impliquent sont
          encadrés par le cadre de protection des données UE–États-Unis (Data
          Privacy Framework) et par les clauses contractuelles types de la
          Commission européenne. Les documents et les données extraites restent
          stockés dans l’Union européenne.
        </p>
      </Block>

      <Block title="6. Base légale des traitements">
        <p>
          Le traitement de tes documents repose sur l’exécution du contrat qui
          nous lie : c’est l’objet même du service auquel tu souscris. La
          conservation limitée des messages bruts repose sur notre intérêt
          légitime à corriger une analyse défaillante. Les vérifications
          anti-abus du parrainage reposent sur notre intérêt légitime à
          prévenir la fraude au programme.
        </p>
      </Block>

      <Block title="7. Tes droits">
        <p>
          Tu disposes des droits d’accès, de rectification, d’effacement, de
          limitation, d’opposition et de portabilité prévus par le RGPD.
        </p>
        <p>
          Depuis tes <Link href="/reglages">réglages</Link>, tu peux à tout
          moment exporter l’intégralité de tes données dans un format lisible
          par machine, et supprimer ton compte. La suppression est immédiate et
          définitive : elle emporte tes documents, tes abonnements, tes alertes,
          et annule l’abonnement payant s’il y en a un.
        </p>
        <p>
          Tu peux introduire une réclamation auprès de la CNIL si tu estimes que
          tes droits ne sont pas respectés.
        </p>
      </Block>

      <Block title="8. Ce que nous ne faisons pas">
        <p>
          Aucune revente de données, aucun partage à des fins publicitaires,
          aucun traceur tiers, aucun profilage à des fins commerciales. Consulte
          la page <Link href="/legal/cookies">cookies</Link> pour le détail de
          ce qui est déposé sur ton appareil.
        </p>
      </Block>

      <Block title="9. Nous contacter">
        {LEGAL.privacyEmail ? (
          <p>
            Pour toute demande relative à tes données :{" "}
            <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>.
            Réponse sous un mois au plus.
          </p>
        ) : (
          <ToComplete>
            l’adresse de contact pour les demandes relatives aux données
            personnelles (à renseigner dans src/lib/legal.ts).
          </ToComplete>
        )}
      </Block>
    </LegalLayout>
  );
}
