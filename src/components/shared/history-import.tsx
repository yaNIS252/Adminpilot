"use client";

import { History } from "lucide-react";

import { CopyBlock } from "@/components/shared/copy-block";
import { useIsPhone } from "@/components/shared/use-is-phone";
import { historySearchQuery } from "@/lib/gmail-filter";

/**
 * Récupérer ses anciennes factures en une fois.
 *
 * Un filtre Gmail ne s'applique qu'aux e-mails à venir. Pour l'historique :
 * une recherche toute prête, tout sélectionner, « Transférer en tant que
 * pièce jointe » vers l'adresse AdminPilot. Chaque e-mail joint est analysé
 * comme s'il avait été transféré seul (voir lib/ingest/forwarded-batch).
 */
export function HistoryImport({ address, domains }: { address: string; domains: string[] }) {
  const phone = useIsPhone();
  const query = historySearchQuery(domains);

  return (
    <div className="flex flex-col gap-3.5">
      <p className="m-0 flex items-start gap-2 text-sm leading-[1.6] text-[var(--text-dim)]">
        <History className="mt-0.5 size-4 shrink-0 text-[var(--accent-light)]" />
        <span>
          Le filtre ne s’applique qu’aux e-mails à venir. Pour tes factures des
          douze derniers mois, une seule manipulation suffit
          {phone ? " (sur Gmail en « version pour ordinateur »)" : ""}.
        </span>
      </p>
      <ol className="m-0 list-decimal space-y-1.5 pl-5 text-sm leading-[1.6] text-[var(--text-dim)]">
        <li>Copie la recherche ci-dessous et colle-la dans la barre de recherche de Gmail.</li>
        <li>
          Vérifie la liste : décoche ce qui n’est pas une facture ou un abonnement.
        </li>
        <li>
          Coche la case <strong className="text-[var(--text)]">tout sélectionner</strong>, puis
          menu ⋮ → <strong className="text-[var(--text)]">Transférer en tant que pièce jointe</strong>.
        </li>
        <li>
          Envoie à ton adresse AdminPilot. Tes abonnements apparaissent dans les
          minutes qui suivent.
        </li>
      </ol>
      <CopyBlock label="Recherche à coller dans Gmail" value={query} multiline />
      <CopyBlock label="Ton adresse AdminPilot" value={address} />
      <p className="m-0 text-xs text-[var(--text-faint)]">
        Jusqu’à 50 e-mails par envoi : au-delà, fais-en plusieurs. Les codes de
        connexion et les e-mails d’AdminPilot sont exclus, et un même e-mail
        envoyé deux fois n’est compté qu’une fois.
      </p>
    </div>
  );
}
