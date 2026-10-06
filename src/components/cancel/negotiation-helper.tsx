"use client";

import { Check, Copy, ExternalLink, Lightbulb, Mail, Phone } from "lucide-react";
import { useState } from "react";

import { useIsPhone } from "@/components/shared/use-is-phone";

/**
 * Message de négociation, modifiable, avec copie en un geste et ouverture
 * dans la messagerie. Les conseils servent pour un appel ou un chat.
 */
export function NegotiationHelper({
  subject,
  body,
  tips,
  contact,
  email,
  accountUrl,
}: {
  subject: string;
  body: string;
  tips: string[];
  /** Adresse du service client, quand le catalogue la connaît. */
  email: string | null;
  /** Comment joindre le fournisseur (téléphone, espace client). */
  contact: string[];
  /** Site du fournisseur, pour rejoindre l'espace client. */
  accountUrl: string | null;
}) {
  const [text, setText] = useState(body);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Presse-papier refusé : le texte reste sélectionnable à la main.
    }
  }

  const phone = useIsPhone();
  const mailto = `mailto:${email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  // Sur ordinateur, `mailto:` n'ouvre rien sans logiciel de messagerie
  // installé, le cas de presque tout le monde : on ouvre Gmail dans le
  // navigateur, le lien `mailto:` reste proposé pour les autres.
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email ?? "")}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

  return (
    <div className="flex flex-col gap-3.5">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={11}
        aria-label="Message de négociation"
        className="w-full resize-y rounded-[8px] border border-[var(--border)] bg-[rgba(255,255,255,.03)] p-3.5 text-[13px] leading-[1.6] text-[var(--text)] outline-none focus:border-[var(--accent)]"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          aria-live="polite"
          className="btn-primary inline-flex h-10 items-center gap-1.5 px-4 text-[13px]"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Message copié" : "Copier le message"}
        </button>
        {email ? (
          phone ? (
            <a href={mailto} className="btn-secondary inline-flex h-10 items-center gap-1.5 px-4 text-[13px]">
              <Mail className="size-4" />
              Envoyer par e-mail
            </a>
          ) : (
            <>
              <a
                href={gmail}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex h-10 items-center gap-1.5 px-4 text-[13px]"
              >
                <Mail className="size-4" />
                Écrire dans Gmail
              </a>
              <a
                href={mailto}
                className="inline-flex h-10 items-center px-2 text-[13px] text-[var(--text-dim)] underline-offset-2 hover:text-[var(--text)] hover:underline"
              >
                Autre messagerie
              </a>
            </>
          )
        ) : (
          accountUrl && (
            <a
              href={accountUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary inline-flex h-10 items-center gap-1.5 px-4 text-[13px]"
            >
              <ExternalLink className="size-4" />
              Ouvrir mon espace client
            </a>
          )
        )}
      </div>
      <p className="m-0 text-xs text-[var(--text-faint)]">
        Colle-le dans le chat ou la messagerie de ton espace client, ou
        sers-t’en de fil conducteur au téléphone.
      </p>

      <div className="rounded-[8px] border border-[var(--border-soft)] px-3.5 py-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium">
          <Phone className="size-4 text-[var(--accent-light)]" />
          Comment les joindre
        </div>
        <ul className="m-0 list-disc space-y-1 pl-5 text-[13px] leading-[1.55] text-[var(--text-dim)]">
          {contact.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="border-t border-[var(--border-soft)] pt-3.5">
        <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium">
          <Lightbulb className="size-4 text-[var(--accent-light)]" />
          Pour obtenir le meilleur geste
        </div>
        <ul className="m-0 list-disc space-y-1.5 pl-5 text-[13px] leading-[1.55] text-[var(--text-dim)]">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <p className="m-0 mt-3 text-xs text-[var(--text-faint)]">
          Remise obtenue ? Mets à jour le prix sur l’abonnement : tes totaux et
          tes rappels suivront.
        </p>
      </div>
    </div>
  );
}
