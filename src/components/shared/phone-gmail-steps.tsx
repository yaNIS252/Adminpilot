"use client";

import { Smartphone } from "lucide-react";

import { CopyBlock } from "@/components/shared/copy-block";
import { BILLING_SUBJECT, EXCLUDED_QUERY, chunkDomains, fromCriteria } from "@/lib/gmail-filter";

/**
 * Création du filtre Gmail depuis un téléphone.
 *
 * L'application Gmail n'a ni les réglages de transfert ni l'import de
 * filtres ; Gmail web, si, en « version pour ordinateur » dans le navigateur
 * du téléphone. Importer un fichier y est pénible : on crée donc le filtre à
 * la main, en collant des critères copiés ici.
 */
export function PhoneGmailSteps({ address, domains }: { address: string; domains: string[] }) {
  const groups = chunkDomains(domains);

  return (
    <div className="flex flex-col gap-3.5">
      <p className="m-0 flex items-start gap-2 rounded-[8px] border border-[rgb(var(--accent-rgb)/.3)] bg-[var(--accent-soft)] px-3.5 py-2.5 text-[13px] leading-[1.55] text-[var(--text-dim)]">
        <Smartphone className="mt-0.5 size-4 shrink-0 text-[var(--accent-lighter)]" />
        <span>
          <strong className="text-[var(--text)]">Sur téléphone</strong>, l’application
          Gmail n’a pas ces réglages. Ouvre{" "}
          <strong className="text-[var(--text)]">mail.google.com</strong> dans Chrome
          ou Safari, puis menu ⋮ (ou « aA » sur iPhone) →{" "}
          <strong className="text-[var(--text)]">Version pour ordinateur</strong>.
        </span>
      </p>

      <ol className="m-0 list-decimal space-y-1.5 pl-5 text-sm leading-[1.6] text-[var(--text-dim)]">
        <li>
          Roue dentée → <strong className="text-[var(--text)]">Voir tous les paramètres</strong> →{" "}
          <strong className="text-[var(--text)]">Filtres et adresses bloquées</strong> →{" "}
          <strong className="text-[var(--text)]">Créer un filtre</strong>.
        </li>
        <li>
          Colle les champs <strong className="text-[var(--text)]">De</strong>,{" "}
          <strong className="text-[var(--text)]">Contient les mots</strong> et{" "}
          <strong className="text-[var(--text)]">Ne contient pas</strong> ci-dessous, puis{" "}
          <strong className="text-[var(--text)]">Créer un filtre</strong>.
        </li>
        <li>
          Coche <strong className="text-[var(--text)]">Transférer à</strong>, choisis ton
          adresse AdminPilot, puis <strong className="text-[var(--text)]">Créer un filtre</strong>.
        </li>
        {groups.length > 1 && (
          <li>Recommence avec le filtre suivant ({groups.length} au total).</li>
        )}
      </ol>

      {groups.map((group, index) => (
        <div key={group[0]} className="flex flex-col gap-2 rounded-[10px] border border-[var(--border-soft)] p-3">
          <span className="text-xs font-medium text-[var(--text)]">
            Filtre {index + 1}
            {groups.length > 1 ? ` sur ${groups.length}` : ""}
          </span>
          <CopyBlock label="Champ « De »" value={fromCriteria(group)} multiline />
          <CopyBlock label="Champ « Contient les mots »" value={BILLING_SUBJECT} multiline />
          <CopyBlock label="Champ « Ne contient pas »" value={EXCLUDED_QUERY} multiline />
        </div>
      ))}
      <CopyBlock label="Transférer à" value={address} />
    </div>
  );
}
