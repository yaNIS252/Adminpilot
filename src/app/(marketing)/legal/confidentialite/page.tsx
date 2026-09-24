import type { Metadata } from "next";
import Link from "next/link";

import {
  Block,
  LegalLayout,
  ToComplete,
} from "@/components/marketing/legal-page";
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
      updated="24 septembre 2026"
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
          ton espace jusqu’à ce que tu les supprimes. Les données extraites sont
          conservées tant que ton compte est actif.
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
            <strong className="text-[var(--text)]">Anthropic</strong> — analyse
            du contenu des messages et documents. Les données ne sont pas
            utilisées pour entraîner de modèle.
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
        </ul>
      </Block>

      <Block title="6. Base légale des traitements">
        <p>
          Le traitement de tes documents repose sur l’exécution du contrat qui
          nous lie : c’est l’objet même du service auquel tu souscris. La
          conservation limitée des messages bruts repose sur notre intérêt
          légitime à corriger une analyse défaillante.
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
        <ToComplete>
          l’adresse de contact pour les demandes relatives aux données
          personnelles.
        </ToComplete>
      </Block>
    </LegalLayout>
  );
}
