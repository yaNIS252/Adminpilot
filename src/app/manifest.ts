import type { MetadataRoute } from "next";

/**
 * Manifeste de l'application installée (« Ajouter à l'écran d'accueil »).
 * `standalone` : elle s'ouvre sans barre d'adresse. Indispensable aussi aux
 * notifications sur iPhone, qui n'existent que pour une app installée.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AdminPilot",
    short_name: "AdminPilot",
    description: "Tes abonnements et tes factures, suivis tout seuls.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    lang: "fr",
    icons: [
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
