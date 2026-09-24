"use client";

import Link from "next/link";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Connexion — Google OAuth et lien magique.
 *
 * Volontairement brute : l'habillage viendra quand le reste sera stabilisé.
 * Seuls comptent ici les deux chemins d'authentification et la gestion d'erreur.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  // La destination voulue est portée par l'URL, posée par le middleware.
  const next =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("next")
      : null;

  const callback = () => {
    const url = new URL("/auth/callback", window.location.origin);
    if (next) url.searchParams.set("next", next);
    return url.toString();
  };

  async function signInWithGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback() },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  async function signInWithEmail(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback() },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <main style={{ maxWidth: 380, margin: "4rem auto", padding: "0 1rem" }}>
      <Link
        href="/"
        style={{ display: "block", marginBottom: "1.5rem", fontWeight: 700, textDecoration: "none", color: "inherit" }}
      >
        AdminPilot
      </Link>

      <h1>Connexion</h1>

      <button type="button" onClick={signInWithGoogle}>
        Continuer avec Google
      </button>

      <form onSubmit={signInWithEmail} style={{ marginTop: "1.5rem" }}>
        <label htmlFor="email">Adresse e-mail</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Envoi…" : "Recevoir un lien de connexion"}
        </button>
      </form>

      {status === "sent" && (
        <p role="status">
          Lien envoyé à {email}. Vérifie ta boîte de réception.
        </p>
      )}
      {status === "error" && <p role="alert">Échec : {message}</p>}
    </main>
  );
}
