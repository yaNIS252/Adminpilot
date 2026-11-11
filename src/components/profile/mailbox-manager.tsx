"use client";

import Link from "next/link";
import { Lock, MailPlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useGmailConfirmation, type GmailConfirmation } from "@/components/onboarding/use-gmail-confirmation";
import { InboxAddress } from "@/components/shared/inbox-address";

type Mailbox = { id: string; address: string; createdAt: string };

/**
 * Boîtes mail branchées sur le compte, et ajout d'une autre (travail,
 * ancienne adresse…). Le code de validation de Gmail s'affiche ici en
 * direct, comme pendant la mise en place.
 */
export function MailboxManager({
  userId,
  inboxAddress,
  mailboxes,
  limit,
  limitHit,
  initialConfirmation,
}: {
  userId: string;
  inboxAddress: string;
  mailboxes: Mailbox[];
  limit: number;
  /** Une boîte en trop a tenté de se brancher récemment. */
  limitHit: boolean;
  initialConfirmation: GmailConfirmation | null;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const confirmation = useGmailConfirmation(userId, initialConfirmation);
  const full = mailboxes.length >= limit;

  async function remove(id: string) {
    setBusy(id);
    await fetch(`/api/mailboxes?id=${id}`, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3.5">
      {mailboxes.length > 0 ? (
        <ul className="m-0 list-none space-y-1 p-0">
          {mailboxes.map((mailbox) => (
            <li
              key={mailbox.id}
              className="flex items-center gap-3 rounded-[8px] border border-[var(--border-soft)] px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{mailbox.address}</span>
              <span className="hidden text-xs text-[var(--text-faint)] sm:inline">
                depuis le {mailbox.createdAt}
              </span>
              <button
                type="button"
                onClick={() => remove(mailbox.id)}
                disabled={busy === mailbox.id}
                title="Retirer de la liste"
                aria-label={`Retirer ${mailbox.address}`}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--text-faint)] hover:bg-[rgba(240,113,104,.12)] hover:text-[var(--danger)] disabled:opacity-50"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-[var(--text-faint)]">
          Aucune boîte Gmail validée pour l’instant. Elle apparaîtra ici dès que Gmail
          enverra son code de confirmation.
        </p>
      )}

      <p className="m-0 text-xs text-[var(--text-faint)]">
        {mailboxes.length} sur {limit} boîte{limit > 1 ? "s" : ""}. Retirer une boîte de cette
        liste libère sa place ; pense aussi à supprimer le transfert dans Gmail.
      </p>

      {(full || limitHit) && limit < 3 ? (
        <div className="flex flex-wrap items-center gap-4 rounded-[10px] border border-[rgb(var(--accent-rgb)/.4)] bg-[var(--accent-soft)] px-4 py-3">
          <Lock className="size-5 shrink-0 text-[var(--accent-lighter)]" />
          <p className="m-0 min-w-[200px] flex-1 text-[13px] leading-[1.5] text-[var(--text-dim)]">
            {limitHit ? (
              <strong className="text-[var(--text)]">Une autre boîte a essayé de se brancher. </strong>
            ) : null}
            Ta formule accepte {limit} boîte mail. Avec{" "}
            <strong className="text-[var(--text)]">Premium</strong>, branches-en jusqu’à 3 :
            perso, travail, ancienne adresse.
          </p>
          <Link href="/reglages?formule=family#formules" className="btn-primary h-10 px-4 text-[13px]">
            Passer Premium
          </Link>
        </div>
      ) : !full ? (
        adding ? (
          <div className="flex flex-col gap-3 rounded-[10px] border border-[var(--border-soft)] p-3.5">
            <ol className="m-0 list-decimal space-y-1.5 pl-5 text-sm leading-[1.6] text-[var(--text-dim)]">
              <li>Connecte-toi à l’autre boîte Gmail.</li>
              <li>
                Roue dentée → <strong className="text-[var(--text)]">Voir tous les paramètres</strong> →{" "}
                <strong className="text-[var(--text)]">Transfert et POP/IMAP</strong> →{" "}
                <strong className="text-[var(--text)]">Ajouter une adresse de transfert</strong>, et
                colle cette adresse :
              </li>
            </ol>
            <InboxAddress address={inboxAddress} />
            {confirmation ? (
              <div className="rounded-[10px] border border-[rgb(var(--accent-rgb)/.4)] bg-[var(--accent-soft)] p-4">
                <p className="m-0 mb-2 text-sm text-[var(--text-dim)]">Code de confirmation de Gmail :</p>
                <div className="mono text-[28px] font-semibold tracking-[0.12em] text-[var(--text-bright)]">
                  {confirmation.code}
                </div>
                {confirmation.url && (
                  <a
                    href={confirmation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary mt-3 h-9 px-3.5 text-[13px]"
                  >
                    Confirmer directement chez Google
                  </a>
                )}
              </div>
            ) : (
              <p className="m-0 flex items-start gap-2.5 text-[13px] leading-[1.6] text-[var(--text-faint)]">
                <span className="mt-[7px] size-1.5 shrink-0 animate-[ap-dot_2s_infinite] rounded-full bg-[var(--accent-light)]" />
                Gmail va envoyer un code de confirmation : il s’affichera ici tout seul.
              </p>
            )}
            <p className="m-0 text-xs text-[var(--text-faint)]">
              Ensuite, importe le même filtre que pour ta première boîte (carte « Transfert
              automatique » ci-dessus).
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn-secondary h-10 self-start px-4 text-sm"
          >
            <MailPlus className="size-4" />
            Brancher une {mailboxes.length ? "autre " : ""}boîte Gmail
          </button>
        )
      ) : null}
    </div>
  );
}
