"use client";

import { useEffect } from "react";

/**
 * Ouvre la section repliée visée par l'ancre de l'URL (`/reglages#boites`).
 *
 * Les cartes des réglages sont des `<details>` fermés par défaut : sans ce
 * composant, un lien « Mes boîtes mail » ferait défiler jusqu'à une carte
 * fermée, et l'utilisateur ne verrait pas ce qu'on voulait lui montrer.
 */
export function HashOpener() {
  useEffect(() => {
    function open() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      const details =
        target instanceof HTMLDetailsElement ? target : target?.querySelector("details");
      if (details && !details.open) {
        details.open = true;
        target?.scrollIntoView({ block: "start" });
      }
    }
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
