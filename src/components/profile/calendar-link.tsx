"use client";

import { CalendarPlus } from "lucide-react";

import { CopyBlock } from "@/components/shared/copy-block";

/**
 * Abonnement de l'agenda de l'utilisateur aux échéances. Un lien suffit :
 * pas de connexion au compte Google, rien à autoriser.
 */
export function CalendarLink({ url }: { url: string }) {
  const webcal = url.replace(/^https?:\/\//, "webcal://");
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`;
  const outlook = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=AdminPilot`;
  const button = "btn-secondary inline-flex h-10 items-center gap-1.5 px-4 text-[13px]";

  return (
    <div className="flex flex-col gap-3.5">
      <p className="m-0 text-sm leading-[1.6] text-[var(--text-dim)]">
        Tes renouvellements, fins d’essai et fins d’engagement apparaissent dans
        ton agenda, avec un rappel la veille. Il se met à jour tout seul.
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={google} target="_blank" rel="noopener noreferrer" className={button}>
          <CalendarPlus className="size-4" />
          Google Agenda
        </a>
        <a href={webcal} className={button}>
          <CalendarPlus className="size-4" />
          Apple Calendrier
        </a>
        <a href={outlook} target="_blank" rel="noopener noreferrer" className={button}>
          <CalendarPlus className="size-4" />
          Outlook
        </a>
      </div>
      <CopyBlock label="Ou copie ce lien dans ton agenda (« S’abonner par URL »)" value={url} />
      <p className="m-0 text-xs text-[var(--text-faint)]">
        Ce lien est personnel : ne le partage pas. Google Agenda peut mettre
        jusqu’à une journée à afficher une modification.
      </p>
    </div>
  );
}
