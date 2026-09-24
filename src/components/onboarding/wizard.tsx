"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Configuration du transfert Gmail — la pièce la plus critique du produit.
 *
 * Gmail envoie un code de validation à l'adresse de destination, c'est-à-dire
 * chez nous. Le pipeline l'intercepte, et cet écran l'affiche en direct via
 * Supabase Realtime. L'utilisateur n'a donc jamais à aller le chercher.
 *
 * C'est ici que se joue le taux d'activation : si quelqu'un abandonne à cette
 * étape, il n'aura jamais rien vu du produit.
 */

type Confirmation = { code: string; url: string | null };

export function OnboardingWizard({
  userId,
  address,
  initialConfirmation,
}: {
  userId: string;
  address: string;
  initialConfirmation: Confirmation | null;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState(initialConfirmation);
  const [copied, setCopied] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Écoute la ligne de profil : dès que le pipeline y écrit le code, il
  // apparaît sans que l'utilisateur ait à rafraîchir.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("onboarding")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const next = (payload.new as { gmail_confirmation: Confirmation | null })
            .gmail_confirmation;
          if (next) setConfirmation(next);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier refusé (contexte non sécurisé, permission) : l'adresse
      // reste sélectionnable à la main, rien n'est bloqué.
    }
  }

  async function finish() {
    setFinishing(true);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ gmail_forward_verified: true })
      .eq("id", userId);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">
        Connecte ta boîte mail
      </h1>
      <p className="mb-8 text-sm text-[var(--text-dim)]">
        AdminPilot lit uniquement les emails que tu lui transfères. Aucun accès
        à ta boîte, aucun mot de passe.
      </p>

      <Step number={1} title="Copie ton adresse AdminPilot">
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm">
            {address}
          </code>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-[var(--radius)] bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
          >
            {copied ? "Copié" : "Copier"}
          </button>
        </div>
      </Step>

      <Step number={2} title="Ajoute-la dans Gmail">
        <p className="m-0 text-sm text-[var(--text-dim)]">
          Dans Gmail : <strong>Paramètres</strong> →{" "}
          <strong>Transfert et POP/IMAP</strong> →{" "}
          <strong>Ajouter une adresse de transfert</strong>. Colle l’adresse
          ci-dessus et valide.
        </p>
      </Step>

      <Step number={3} title="Le code de confirmation">
        {confirmation ? (
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--accent-soft)] p-4">
            <p className="m-0 mb-2 text-sm">
              Gmail vient d’envoyer son code. Le voici :
            </p>
            <div className="tabular mb-3 text-2xl font-bold tracking-widest">
              {confirmation.code}
            </div>
            {confirmation.url && (
              <a
                href={confirmation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--accent)]"
              >
                Confirmer directement chez Google
              </a>
            )}
          </div>
        ) : (
          <p className="m-0 text-sm text-[var(--text-dim)]">
            Gmail va t’envoyer un code de validation. Il arrive chez nous, donc
            il s’affichera ici tout seul — reste sur cette page.
          </p>
        )}
      </Step>

      <Step number={4} title="Crée le filtre (recommandé)">
        <p className="m-0 text-sm text-[var(--text-dim)]">
          Pour que tout soit automatique : Gmail →{" "}
          <strong>Filtres et adresses bloquées</strong> →{" "}
          <strong>Créer un filtre</strong>, avec comme critère{" "}
          <code className="rounded bg-[var(--surface-alt)] px-1">
            facture OR abonnement OR prélèvement OR renouvellement
          </code>
          , puis coche <strong>Transférer à</strong> ton adresse AdminPilot.
        </p>
        <p className="m-0 mt-2 text-sm text-[var(--text-dim)]">
          Tu peux aussi sauter cette étape et transférer tes emails à la main.
        </p>
      </Step>

      <button
        type="button"
        onClick={finish}
        disabled={finishing}
        className="mt-4 w-full rounded-[var(--radius)] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {finishing ? "…" : "C’est fait, accéder à AdminPilot"}
      </button>
    </>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs text-[var(--accent)]">
          {number}
        </span>
        {title}
      </h2>
      <div className="pl-8">{children}</div>
    </section>
  );
}
