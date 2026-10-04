"use client";

import { openWelcomeTour } from "@/components/onboarding/welcome-tour";

/** Rouvre la présentation de bienvenue à une étape donnée. */
export function OpenTourButton({
  step,
  className,
  children,
}: {
  step: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={() => openWelcomeTour(step)} className={className}>
      {children}
    </button>
  );
}
