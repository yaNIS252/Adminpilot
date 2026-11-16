"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export type GmailConfirmation = { code: string; url: string | null };

/**
 * Code de validation du transfert Gmail, affiché en direct.
 *
 * Gmail envoie ce code à l'adresse de destination, c'est-à-dire chez nous :
 * la réception l'écrit sur le profil, et cet abonnement temps réel le fait
 * apparaître sans que l'utilisateur ait à rafraîchir ni à aller le chercher.
 */
export function useGmailConfirmation(userId: string, initial: GmailConfirmation | null) {
  const [confirmation, setConfirmation] = useState(initial);

  useEffect(() => {
    const supabase = createClient();
    // Nom propre à chaque instance : le client Supabase est partagé, et deux
    // composants (accueil et réglages) qui ouvraient la même chaîne
    // recevaient celle déjà abonnée, sur laquelle on ne peut plus rien
    // brancher — erreur à l'affichage des réglages.
    const channel = supabase
      .channel(`gmail-confirmation-${userId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const next = (payload.new as { gmail_confirmation: GmailConfirmation | null })
            .gmail_confirmation;
          if (next) setConfirmation(next);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return confirmation;
}
