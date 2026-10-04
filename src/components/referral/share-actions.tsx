"use client";

import { Check, Copy, MessageCircle, Send, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

function noopSubscribe() {
  return () => {};
}

/**
 * Boutons de partage du lien de parrainage : copie, partage natif du
 * téléphone quand il existe, WhatsApp et SMS sinon.
 */
export function ShareActions({ link, message }: { link: string; message: string }) {
  const [copied, setCopied] = useState(false);
  // Le partage natif n'existe qu'au navigateur (et surtout sur mobile) :
  // instantané serveur à faux, pour un rendu identique à l'hydratation.
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const text = `${message} ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Presse-papier refusé (navigateur intégré d'une appli) : le lien reste
      // sélectionnable à la main.
      window.prompt("Copie ce lien :", link);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "AdminPilot", text: message, url: link });
    } catch {
      // Partage annulé : rien à faire.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copy}
        aria-live="polite"
        className="btn-primary inline-flex h-10 items-center gap-1.5 px-4 text-[13px]"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Lien copié" : "Copier le lien"}
      </button>
      {canShare ? (
        <button
          type="button"
          onClick={share}
          className="btn-secondary inline-flex h-10 items-center gap-1.5 px-4 text-[13px]"
        >
          <Share2 className="size-4" />
          Partager
        </button>
      ) : null}
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary inline-flex h-10 items-center gap-1.5 px-4 text-[13px]"
      >
        <MessageCircle className="size-4" />
        WhatsApp
      </a>
      <a
        href={`sms:?&body=${encodeURIComponent(text)}`}
        className="btn-secondary inline-flex h-10 items-center gap-1.5 px-4 text-[13px]"
      >
        <Send className="size-4" />
        SMS
      </a>
    </div>
  );
}
