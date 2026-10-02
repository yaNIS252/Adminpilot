import type { Metadata } from "next";
import Link from "next/link";

import { Block, LegalLayout } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Cookies — AdminPilot",
  description:
    "AdminPilot ne dépose que les cookies strictement nécessaires à la connexion. Aucun traceur publicitaire, aucune mesure d'audience tierce.",
};

/**
 * Page cookies.
 *
 * AdminPilot ne dépose que des cookies d'authentification. La CNIL exempte
 * explicitement de consentement les cookies strictement nécessaires à la
 * fourniture d'un service expressément demandé — donc pas de bannière.
 *
 * Afficher une bannière quand même serait doublement mauvais : elle
 * habituerait l'utilisateur à cliquer « accepter » sans lire, et donnerait à
 * penser qu'on le piste alors que non.
 *
 * Si de la mesure d'audience ou un traceur tiers est ajouté un jour, cette
 * page doit changer ET une bannière devient obligatoire.
 */
export default function CookiesPage() {
  return (
    <LegalLayout
      title="Cookies"
      intro="Ce qui est déposé sur ton appareil, et pourquoi il n’y a pas de bannière."
      updated="2 octobre 2026"
      current="/legal/cookies"
    >
      <Block title="Pourquoi aucune bannière ne s’affiche">
        <p>
          AdminPilot ne dépose que des cookies strictement nécessaires au
          fonctionnement du service : ceux qui te maintiennent connecté et retiennent tes choix. La
          réglementation française et européenne exempte ces cookies de
          consentement préalable, parce qu’ils sont indispensables à la
          fourniture d’un service que tu as expressément demandé.
        </p>
        <p>
          Nous aurions pu afficher une bannière par précaution. Nous ne le
          faisons pas volontairement : elle habituerait à cliquer « accepter »
          sans lire, et laisserait croire à un pistage qui n’existe pas.
        </p>
      </Block>

      <Block title="Ce qui est réellement déposé">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-faint)]">
                <th className="py-2 pr-4 font-medium">Nom</th>
                <th className="py-2 pr-4 font-medium">Rôle</th>
                <th className="py-2 font-medium">Durée</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border-soft)]">
                <td className="mono py-2.5 pr-4 text-[13px] text-[var(--text)]">
                  sb-…-auth-token
                </td>
                <td className="py-2.5 pr-4">
                  Maintient ta session ouverte entre deux visites
                </td>
                <td className="py-2.5 whitespace-nowrap">1 an</td>
              </tr>
              <tr className="border-b border-[var(--border-soft)]">
                <td className="mono py-2.5 pr-4 text-[13px] text-[var(--text)]">
                  sb-…-auth-token-code-verifier
                </td>
                <td className="py-2.5 pr-4">
                  Sécurise l’échange lors de la connexion
                </td>
                <td className="py-2.5 whitespace-nowrap">Le temps de la connexion</td>
              </tr>
              <tr className="border-b border-[var(--border-soft)]">
                <td className="mono py-2.5 pr-4 text-[13px] text-[var(--text)]">
                  ap_upsell_hidden
                </td>
                <td className="py-2.5 pr-4">
                  Se souvient que tu as fermé la bannière « Passe Pro »
                </td>
                <td className="py-2.5 whitespace-nowrap">30 jours</td>
              </tr>
              <tr>
                <td className="mono py-2.5 pr-4 text-[13px] text-[var(--text)]">
                  ap_letter_sender
                </td>
                <td className="py-2.5 pr-4">
                  Garde dans ton navigateur (stockage local, jamais envoyé à nos
                  serveurs hors lettre) l’adresse saisie pour tes lettres de
                  résiliation
                </td>
                <td className="py-2.5 whitespace-nowrap">Jusqu’à effacement</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Les deux premiers sont posés par Supabase, notre prestataire
          d’authentification ; les deux derniers par AdminPilot, pour retenir
          un choix que tu as fait. Tous ne sont lisibles que par AdminPilot et
          sont exemptés de consentement : ils servent uniquement le service que
          tu utilises.
        </p>
      </Block>

      <Block title="Ce qui n’est pas déposé">
        <ul className="m-0 space-y-1.5 pl-5">
          <li>Aucun cookie publicitaire</li>
          <li>Aucun traceur de réseau social</li>
          <li>Aucune mesure d’audience tierce</li>
          <li>Aucun pixel de suivi dans les emails d’alerte</li>
        </ul>
      </Block>

      <Block title="Les refuser">
        <p>
          Tu peux bloquer ces cookies depuis les réglages de ton navigateur,
          mais la connexion au service cessera alors de fonctionner : ce sont
          eux qui te maintiennent identifié d’une page à l’autre.
        </p>
      </Block>

      <Block title="Si cela change">
        <p>
          Si de la mesure d’audience ou un traceur tiers est ajouté un jour,
          cette page sera mise à jour et une bannière de consentement
          apparaîtra, comme la loi l’exige. Consulte aussi notre{" "}
          <Link href="/legal/confidentialite">politique de confidentialité</Link>
          .
        </p>
      </Block>
    </LegalLayout>
  );
}
