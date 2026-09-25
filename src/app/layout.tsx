import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

import "./globals.css";

/**
 * Geist, la typographie de la maquette. Chargée via next/font : les fichiers
 * sont servis depuis notre domaine, donc pas de requête vers Google au
 * chargement — meilleure performance, et un sous-traitant de moins à déclarer
 * dans la politique de confidentialité.
 */
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

/**
 * Une typographie à empattements pour les titres, et pour eux seuls.
 *
 * Un sans-serif géométrique en graisse extra-bold sur fond sombre, c'est la
 * signature de mille pages d'accueil générées. Un serif de titrage déplace le
 * ton vers l'éditorial — un journal, un document — ce qui colle mieux à un
 * produit qui parle de contrats et de lettres recommandées. Le corps de texte
 * reste en Geist, plus lisible aux petites tailles.
 */
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AdminPilot — le pilote automatique de ta vie admin",
  description:
    "AdminPilot repère tes abonnements dans les emails que tu lui transfères, classe tes documents et t'alerte avant chaque reconduction tacite.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
