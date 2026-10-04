"use client";

import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";

/**
 * Mise en place du transfert automatique des factures, par messagerie.
 *
 * Gmail : un fichier de filtres à importer, généré pour l'utilisateur. Les
 * autres messageries n'importent pas de filtres : on leur donne la liste des
 * expéditeurs à copier dans une règle de transfert.
 */

export type Mailbox = "gmail" | "outlook" | "autre";

const TABS: { id: Mailbox; label: string }[] = [
  { id: "gmail", label: "Gmail" },
  { id: "outlook", label: "Outlook / Hotmail" },
  { id: "autre", label: "Autre" },
];

export function ForwardingSetup({
  address,
  domains,
  mailbox: fixedMailbox,
}: {
  address: string;
  domains: string[];
  /** Messagerie déjà choisie (présentation de bienvenue) : onglets masqués. */
  mailbox?: Mailbox;
}) {
  const [chosenMailbox, setMailbox] = useState<Mailbox>("gmail");
  const mailbox = fixedMailbox ?? chosenMailbox;
  // Décoché par défaut (protection des données dès la conception, art. 25
  // du RGPD) : ce filtre capte des expéditeurs inconnus, donc parfois des
  // e-mails personnels. L'utilisateur l'active en connaissance de cause.
  const [keywords, setKeywords] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {!fixedMailbox && (
        <div role="tablist" aria-label="Messagerie" className="inline-flex flex-wrap gap-1 self-start rounded-[10px] border border-[var(--border)] p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mailbox === tab.id}
              onClick={() => setMailbox(tab.id)}
              className={`rounded-[7px] px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                mailbox === tab.id
                  ? "bg-[var(--paper)] text-[var(--ink)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {mailbox === "gmail" && (
        <div className="flex flex-col gap-3.5">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[var(--text-dim)]">
            <input
              type="checkbox"
              checked={keywords}
              onChange={(event) => setKeywords(event.target.checked)}
              className="mt-1 accent-[var(--accent)]"
            />
            <span>
              Inclure aussi les e-mails dont l’objet parle de facture, de
              prélèvement ou de renouvellement{" "}
              <span className="text-[var(--text-faint)]">
                — capte les fournisseurs que nous ne connaissons pas encore,
                mais aussi parfois un e-mail personnel ou une facture médicale.
                Ce qui n’est pas une facture d’abonnement est effacé dès
                l’analyse.
              </span>
            </span>
          </label>

          <a
            href={`/api/gmail-filter?mots=${keywords ? 1 : 0}`}
            download="adminpilot-filtres-gmail.xml"
            className="btn-primary h-10 self-start px-4 text-sm"
          >
            <Download className="size-4" />
            Télécharger mon filtre Gmail
          </a>

          <ol className="m-0 list-decimal space-y-1.5 pl-5 text-sm leading-[1.6] text-[var(--text-dim)]">
            <li>
              Sur ordinateur, dans Gmail : roue dentée →{" "}
              <strong className="text-[var(--text)]">Voir tous les paramètres</strong>.
            </li>
            <li>
              Onglet{" "}
              <strong className="text-[var(--text)]">Filtres et adresses bloquées</strong>, tout
              en bas : <strong className="text-[var(--text)]">Importer des filtres</strong>.
            </li>
            <li>
              Choisis le fichier téléchargé, puis{" "}
              <strong className="text-[var(--text)]">Ouvrir le fichier</strong>.
            </li>
            <li>
              Clique sur <strong className="text-[var(--text)]">Créer des filtres</strong>. C’est
              fini.
            </li>
          </ol>

          <p className="m-0 text-xs text-[var(--text-faint)]">
            Les codes de connexion et alertes de sécurité ne sont jamais
            transférés. Ton adresse AdminPilot doit déjà être validée comme adresse de
            transfert dans Gmail. Le filtre vaut pour les e-mails qui arrivent
            ensuite : transfère tes factures récentes à la main une fois.
            L’import se fait depuis un ordinateur, pas depuis l’application
            mobile.
          </p>
        </div>
      )}

      {mailbox === "outlook" && (
        <div className="flex flex-col gap-3.5">
          <ol className="m-0 list-decimal space-y-1.5 pl-5 text-sm leading-[1.6] text-[var(--text-dim)]">
            <li>
              Sur outlook.com : roue dentée →{" "}
              <strong className="text-[var(--text)]">Courrier</strong> →{" "}
              <strong className="text-[var(--text)]">Règles</strong> →{" "}
              <strong className="text-[var(--text)]">Ajouter une nouvelle règle</strong>.
            </li>
            <li>
              Condition <strong className="text-[var(--text)]">De</strong> : colle la liste des
              expéditeurs ci-dessous.
            </li>
            <li>
              Action <strong className="text-[var(--text)]">Rediriger vers</strong> : ton adresse
              AdminPilot.
            </li>
          </ol>
          <CopyBlock label="Ton adresse AdminPilot" value={address} />
          <CopyBlock label="Expéditeurs à transférer" value={domains.join("; ")} multiline />
        </div>
      )}

      {mailbox === "autre" && (
        <div className="flex flex-col gap-3.5">
          <p className="m-0 text-sm leading-[1.6] text-[var(--text-dim)]">
            Si ta messagerie propose des règles ou des filtres de transfert
            (iCloud, Free, Orange, SFR…), crée une règle « si l’expéditeur fait
            partie de cette liste, transférer à mon adresse AdminPilot ». Sinon,
            transfère simplement tes factures quand elles arrivent.
          </p>
          <CopyBlock label="Ton adresse AdminPilot" value={address} />
          <CopyBlock label="Expéditeurs à transférer" value={domains.join(", ")} multiline />
        </div>
      )}
    </div>
  );
}

function CopyBlock({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-[var(--text-dim)]">{label}</span>
        <button type="button" onClick={copy} className="btn-link flex items-center gap-1 p-0 text-xs">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <div
        className={`mono rounded-[8px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-[12px] text-[var(--text-muted)] ${
          multiline ? "max-h-24 overflow-y-auto break-words" : "overflow-x-auto whitespace-nowrap"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
