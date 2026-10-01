"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ForwardingSetup } from "@/components/shared/forwarding-setup";
import { InboxAddress } from "@/components/shared/inbox-address";
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
  domains,
  initialConfirmation,
}: {
  userId: string;
  address: string;
  /** Expéditeurs connus, pour les règles des messageries autres que Gmail. */
  domains: string[];
  initialConfirmation: Confirmation | null;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState(initialConfirmation);
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
      <div className="section-mark">Configuration · 2 minutes</div>
      <h1 className="serif mt-6 mb-3 text-[clamp(40px,8vw,56px)] leading-[1.02]">
        Branche ta <em>boîte mail.</em>
      </h1>
      <p className="mt-0 mb-12 max-w-[460px] text-[15px] leading-[1.65] text-[var(--text-dim)]">
        AdminPilot ne lit que les emails que tu lui transfères. Aucun accès à ta
        boîte, aucun mot de passe.
      </p>

      <ol className="m-0 list-none p-0">
        <Step number={1} title="Copie ton adresse AdminPilot">
          <InboxAddress address={address} />
        </Step>

        <Step number={2} title="Ajoute-la dans Gmail">
          <p className="m-0 text-sm leading-[1.7] text-[var(--text-dim)]">
            Dans Gmail :{" "}
            <strong className="text-[var(--text)]">Paramètres</strong> →{" "}
            <strong className="text-[var(--text)]">Transfert et POP/IMAP</strong>{" "}
            →{" "}
            <strong className="text-[var(--text)]">
              Ajouter une adresse de transfert
            </strong>
            . Colle l’adresse ci-dessus et valide.
          </p>
        </Step>

        <Step number={3} title="Le code de confirmation">
          {confirmation ? (
            <div className="rounded-[10px] border border-[rgb(var(--accent-rgb)/.4)] bg-[var(--accent-soft)] p-5">
              <p className="m-0 mb-3 text-sm text-[var(--text-dim)]">
                Gmail vient d’envoyer son code. Le voici :
              </p>
              <div className="mono mb-4 text-[32px] font-semibold tracking-[0.12em] text-[var(--text-bright)]">
                {confirmation.code}
              </div>
              {confirmation.url && (
                <a
                  href={confirmation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary h-10 px-4 text-sm"
                >
                  Confirmer directement chez Google
                </a>
              )}
            </div>
          ) : (
            <p className="m-0 flex items-start gap-2.5 text-sm leading-[1.7] text-[var(--text-dim)]">
              {/* Indicateur d’attente : le code est écouté en temps réel, il
                  faut que l’utilisateur voie que quelque chose veille. */}
              <span className="mt-[7px] size-1.5 shrink-0 animate-[ap-dot_2s_infinite] rounded-full bg-[var(--accent-light)]" />
              Gmail va t’envoyer un code de validation. Il arrive chez nous,
              donc il s’affichera ici tout seul — reste sur cette page.
            </p>
          )}
        </Step>

        <Step number={4} title="Rends le transfert automatique" hint="recommandé" last>
          <p className="m-0 mb-4 text-sm leading-[1.7] text-[var(--text-dim)]">
            Un filtre transfère tout seul tes futures factures. Deux minutes
            une fois, puis plus rien à faire. Tu peux aussi sauter cette étape
            et transférer tes e-mails à la main.
          </p>
          <ForwardingSetup address={address} domains={domains} />
        </Step>
      </ol>

      <button
        type="button"
        onClick={finish}
        disabled={finishing}
        className="btn-primary mt-10 h-12 w-full text-[15px] disabled:opacity-60"
      >
        {finishing ? "Un instant…" : "C’est fait, accéder à AdminPilot"}
      </button>
    </>
  );
}

/**
 * Une étape, reliée à la suivante par un filet vertical : on lit un parcours,
 * pas quatre blocs indépendants. Le numéro en chiffres mono rappelle les
 * sections numérotées du reste du site.
 */
function Step({
  number,
  title,
  hint,
  last,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative grid grid-cols-[36px_1fr] gap-x-4">
      <div className="flex flex-col items-center">
        <span className="mono grid size-8 shrink-0 place-items-center rounded-full border border-[var(--border-strong)] text-xs text-[var(--text-muted)]">
          {String(number).padStart(2, "0")}
        </span>
        {!last && (
          <span aria-hidden className="w-px flex-1 bg-[var(--border)]" />
        )}
      </div>
      <div className={last ? "pb-0" : "pb-10"}>
        <h2 className="mt-1.5 mb-3 flex items-baseline gap-2.5 text-[16px] font-semibold">
          {title}
          {hint && (
            <span className="font-mono text-[11px] font-normal tracking-[0.06em] text-[var(--text-faint)] uppercase">
              {hint}
            </span>
          )}
        </h2>
        {children}
      </div>
    </li>
  );
}
