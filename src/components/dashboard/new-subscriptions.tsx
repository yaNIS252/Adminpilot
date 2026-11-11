"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Nouveaux abonnements détectés depuis la dernière visite. Les voir ici les
 * marque comme lus : la pastille de la barre latérale disparaît.
 */
export function NewSubscriptions({ items }: { items: { id: string; title: string; message: string }[] }) {
  const router = useRouter();

  useEffect(() => {
    void createClient()
      .from("alerts")
      .update({ read_at: new Date().toISOString() })
      .in(
        "id",
        items.map((item) => item.id),
      )
      .then(() => router.refresh());
  }, [items, router]);

  return (
    <section
      role="status"
      className="anim-up rounded-[var(--radius-xl)] border border-[rgb(var(--accent-rgb)/.35)] bg-[var(--accent-soft)] px-5 py-4"
    >
      <h2 className="m-0 flex items-center gap-2 text-[15px] font-semibold">
        <Sparkles className="size-4 text-[var(--accent-lighter)]" />
        {items.length === 1 ? "Nouvel abonnement détecté" : `${items.length} nouveaux abonnements détectés`}
      </h2>
      <ul className="m-0 mt-2 list-none space-y-1 p-0 text-sm text-[var(--text-dim)]">
        {items.map((item) => (
          <li key={item.id}>
            <strong className="font-medium text-[var(--text)]">
              {item.title.replace(/^Nouvel abonnement détecté : /, "")}
            </strong>{" "}
            · {item.message}
          </li>
        ))}
      </ul>
      <p className="m-0 mt-2 text-xs text-[var(--text-faint)]">
        Ce n’est pas toi ? Vérifie-le avant le prochain prélèvement.
      </p>
    </section>
  );
}
