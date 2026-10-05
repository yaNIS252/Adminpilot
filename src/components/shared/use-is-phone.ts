"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse) and (max-width: 900px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * Vrai sur un téléphone (écran tactile étroit). Les réglages de transfert de
 * Gmail n'existent pas dans son application mobile : les explications
 * changent. Rendu serveur : ordinateur, puis correction au chargement.
 */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
