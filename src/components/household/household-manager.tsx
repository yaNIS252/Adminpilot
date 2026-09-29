"use client";

import { useRouter } from "next/navigation";
import { Check, Copy, Mail, UserPlus, X } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/shared/avatar";

/**
 * Gestion du foyer par le titulaire Premium : inviter, suivre les invitations,
 * retirer un membre.
 */

export type HouseholdRow = {
  id: string;
  email: string;
  name: string | null;
  joined: boolean;
  expired: boolean;
  avatarUrl: string | null;
};

export function HouseholdManager({
  ownerName,
  ownerAvatarUrl,
  rows,
  slots,
}: {
  ownerName: string;
  ownerAvatarUrl: string | null;
  rows: HouseholdRow[];
  /** Places d'invités au total, titulaire exclu. */
  slots: number;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ link: string; emailed: boolean; to: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const free = slots - rows.length;

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInvite(null);
    try {
      const response = await fetch("/api/household", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        setInvite({ link: body.link, emailed: body.emailed, to: email });
        setEmail("");
        setName("");
        router.refresh();
      } else {
        setError(
          {
            household_full: "Ton foyer est complet. Retire quelqu’un pour inviter une autre personne.",
            already_member: "Cette personne fait déjà partie de ton foyer.",
            self: "C’est ta propre adresse.",
          }[body.code as string] ??
            (response.status === 429
              ? "Trop d’invitations d’un coup. Réessaie dans une heure."
              : response.status === 400
                ? "Adresse e-mail invalide."
                : "L’invitation n’a pas pu être créée. Réessaie."),
        );
      }
    } catch {
      setError("Connexion interrompue. Réessaie.");
    }
    setBusy(false);
  }

  async function remove(row: HouseholdRow) {
    const question = row.joined
      ? `Retirer ${row.name ?? row.email} du foyer ? Son compte repassera en formule gratuite ; ses données restent les siennes.`
      : `Annuler l’invitation envoyée à ${row.email} ?`;
    if (!window.confirm(question)) return;

    const response = await fetch(`/api/household?id=${row.id}`, { method: "DELETE" });
    if (response.ok) router.refresh();
    else setError("La suppression a échoué. Réessaie.");
  }

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="m-0 list-none p-0">
        <MemberLine
          name={ownerName}
          avatarUrl={ownerAvatarUrl}
          status="Titulaire"
        />
        {rows.map((row) => (
          <MemberLine
            key={row.id}
            name={row.name ?? row.email}
            detail={row.name ? row.email : undefined}
            avatarUrl={row.avatarUrl}
            status={row.joined ? "Membre" : row.expired ? "Invitation expirée" : "Invitation envoyée"}
            muted={!row.joined}
            onRemove={() => remove(row)}
            removeLabel={row.joined ? "Retirer du foyer" : "Annuler l’invitation"}
          />
        ))}
      </ul>

      {free > 0 ? (
        <form onSubmit={send} className="flex flex-col gap-2.5">
          <div className="text-[13px] font-medium">
            Inviter un proche{" "}
            <span className="font-normal text-[var(--text-faint)]">
              · {free} place{free > 1 ? "s" : ""} libre{free > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="adresse@exemple.fr"
              aria-label="Adresse e-mail de la personne à inviter"
              className="h-10 min-w-[200px] flex-[2] rounded-[8px] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Prénom (facultatif)"
              aria-label="Prénom"
              maxLength={60}
              className="h-10 min-w-[140px] flex-1 rounded-[8px] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={busy}
              className="btn-primary h-10 px-4 text-sm disabled:opacity-60"
            >
              <UserPlus className="size-4" />
              {busy ? "Envoi…" : "Inviter"}
            </button>
          </div>
        </form>
      ) : (
        <p className="m-0 text-[13px] text-[var(--text-faint)]">
          Ton foyer est complet ({slots + 1} comptes).
        </p>
      )}

      {invite && (
        <div role="status" className="rounded-[10px] border border-[var(--border)] bg-[rgba(255,255,255,.02)] p-4">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <Mail className="size-4 text-[var(--accent-light)]" />
            {invite.emailed
              ? `Invitation envoyée à ${invite.to}.`
              : `Invitation créée pour ${invite.to}.`}
          </div>
          <p className="m-0 mt-1 text-xs text-[var(--text-faint)]">
            {invite.emailed
              ? "Tu peux aussi lui envoyer ce lien directement (SMS, messagerie). Il n’est affiché qu’une fois et reste valable 14 jours."
              : "L’e-mail n’a pas pu partir : envoie-lui ce lien toi-même (SMS, messagerie). Il n’est affiché qu’une fois et reste valable 14 jours."}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              readOnly
              value={invite.link}
              onFocus={(event) => event.currentTarget.select()}
              aria-label="Lien d’invitation"
              className="mono h-9 min-w-0 flex-1 rounded-[8px] border border-[var(--border)] bg-transparent px-3 text-xs text-[var(--text-dim)]"
            />
            <button type="button" onClick={copy} className="btn-secondary h-9 px-3 text-xs">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="m-0 text-[13px] text-[var(--danger-light)]">
          {error}
        </p>
      )}

      <p className="m-0 text-xs text-[var(--text-faint)]">
        Chacun a son propre compte et sa propre adresse de transfert. Personne
        ne voit les documents ni les abonnements des autres.
      </p>
    </div>
  );
}

function MemberLine({
  name,
  detail,
  avatarUrl,
  status,
  muted = false,
  onRemove,
  removeLabel,
}: {
  name: string;
  detail?: string;
  avatarUrl: string | null;
  status: string;
  muted?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-[var(--border-soft)] py-2.5 last:border-b-0">
      <Avatar name={name} url={avatarUrl} size={32} />
      <div className={`min-w-0 flex-1 ${muted ? "opacity-70" : ""}`}>
        <div className="truncate text-sm font-medium">{name}</div>
        {detail && (
          <div className="truncate text-xs text-[var(--text-faint)]">{detail}</div>
        )}
      </div>
      <span className="text-xs text-[var(--text-faint)]">{status}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title={removeLabel}
          aria-label={removeLabel}
          className="grid size-8 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[rgba(240,113,104,.12)] hover:text-[var(--danger)]"
        >
          <X className="size-4" />
        </button>
      )}
    </li>
  );
}

/** Vue d'un membre invité : de qui il tient sa formule, et comment partir. */
export function HouseholdMembership({ ownerName }: { ownerName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function leave() {
    if (!window.confirm(`Quitter le foyer de ${ownerName} ? Ton compte repassera en formule gratuite.`)) {
      return;
    }
    setBusy(true);
    const response = await fetch("/api/household", { method: "PATCH" });
    if (response.ok) {
      router.refresh();
    } else {
      setError("Impossible de quitter le foyer pour l’instant.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-[var(--text-dim)]">
        Ta formule Premium est offerte par{" "}
        <strong className="text-[var(--text)]">{ownerName}</strong>. Tes
        données restent privées : personne dans le foyer ne voit tes documents
        ni tes abonnements.
      </p>
      <button
        type="button"
        onClick={leave}
        disabled={busy}
        className="btn-secondary h-10 self-start px-4 text-sm disabled:opacity-60"
      >
        {busy ? "Un instant…" : "Quitter le foyer"}
      </button>
      {error && (
        <p role="alert" className="m-0 text-xs text-[var(--danger-light)]">
          {error}
        </p>
      )}
    </div>
  );
}
