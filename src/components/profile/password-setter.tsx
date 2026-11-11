"use client";

import { Check, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD = 8;

/**
 * Définir ou changer son mot de passe. Utile surtout à qui s'est inscrit avec
 * Google ou un code : il peut ensuite se connecter aussi par mot de passe.
 */
export function PasswordSetter() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setState("error");
      setMessage(`Au moins ${MIN_PASSWORD} caractères.`);
      return;
    }
    setState("busy");
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setState("error");
      const raw = error.message.toLowerCase();
      setMessage(
        raw.includes("same")
          ? "C’est déjà ton mot de passe actuel."
          : raw.includes("weak") || raw.includes("characters")
            ? "Mot de passe trop faible : mélange lettres, chiffres et symboles."
            : raw.includes("reauthentication") || raw.includes("recent")
              ? "Par sécurité, reconnecte-toi puis réessaie."
              : "Le changement a échoué. Réessaie.",
      );
      return;
    }
    setPassword("");
    setState("done");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="m-0 text-sm text-[var(--text-dim)]">
        Pour te connecter aussi avec ton adresse et un mot de passe, en plus de
        Google ou du code par e-mail.
      </p>
      <div className="flex flex-wrap gap-2">
        <div className="flex h-10 min-w-[220px] flex-1 items-center rounded-[8px] border border-[var(--border)] bg-[rgba(255,255,255,.03)] pr-1 pl-3 focus-within:border-[var(--accent)]">
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (state !== "busy") setState("idle");
            }}
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            placeholder="Nouveau mot de passe"
            aria-label="Nouveau mot de passe"
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((value) => !value)}
            aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="grid size-8 place-items-center rounded-md text-[var(--text-faint)] hover:text-[var(--text)]"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <button type="submit" disabled={state === "busy"} className="btn-primary h-10 px-4 text-sm disabled:opacity-60">
          Enregistrer
        </button>
      </div>
      {state === "done" && (
        <p className="m-0 flex items-center gap-1.5 text-[13px] text-[var(--positive-light)]">
          <Check className="size-4" /> Mot de passe enregistré.
        </p>
      )}
      {state === "error" && <p className="m-0 text-[13px] text-[var(--danger-light)]">{message}</p>}
    </form>
  );
}
