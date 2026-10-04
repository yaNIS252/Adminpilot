import { redirect } from "next/navigation";

/**
 * Ancien écran de configuration. La mise en place se fait désormais dans la
 * présentation de bienvenue, par-dessus l'application ; l'adresse reste
 * valable pour les liens déjà envoyés.
 */
export default function OnboardingPage() {
  redirect("/dashboard");
}
