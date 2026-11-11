"use client";

import { Printer } from "lucide-react";

/** Ouvre l'impression du navigateur, qui propose « Enregistrer en PDF ». */
export function PrintButton({ label = "Enregistrer en PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary h-10 px-4 text-[13px]">
      <Printer className="size-4" />
      {label}
    </button>
  );
}
