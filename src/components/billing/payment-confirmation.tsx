import { PLAN_LABELS } from "@/lib/constants";
import type { Enums } from "@/lib/supabase/types";

/**
 * Bandeau de retour de Stripe (`?abonnement=actif`), sur la page d'où le
 * paiement est parti. Le webhook peut arriver une seconde après : sans plan
 * payant encore visible, on annonce l'activation au lieu d'un échec.
 */
export function PaymentConfirmation({ plan }: { plan: Enums<"plan"> }) {
  return (
    <section
      role="status"
      className="rounded-[10px] border border-[rgba(63,207,149,.35)] bg-[rgba(63,207,149,.06)] px-5 py-4"
    >
      <div className="text-[15px] font-semibold">
        {plan !== "free"
          ? `Bienvenue en ${PLAN_LABELS[plan]}.`
          : "Paiement reçu, activation en cours."}
      </div>
      <p className="m-0 mt-0.5 text-[13px] text-[var(--text-dim)]">
        {plan !== "free"
          ? "Tout est débloqué, y compris les abonnements déjà détectés au-delà de la limite gratuite. Ta facture est disponible dans les réglages."
          : "Ta formule sera active d’ici quelques secondes. Recharge la page si rien ne change."}
      </p>
    </section>
  );
}
