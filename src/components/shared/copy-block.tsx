"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Valeur à recopier ailleurs (Gmail, Outlook…), avec copie en un geste. */
export function CopyBlock({
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
