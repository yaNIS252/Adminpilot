"use client";

import Link from "next/link";
import { useId, useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  ExternalLink,
  Mail,
  MailCheck,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

/**
 * Panneau d'authentification — connexion et création de compte.
 *
 * Il n'y a pas de mot de passe : Google OAuth ou lien à usage unique. C'est le
 * choix le plus sûr pour un produit qui manipule des factures — aucun secret à
 * stocker, à hacher, à faire tourner, ni à se faire voler.
 *
 * Les deux onglets ne sont pas cosmétiques. Supabase crée le compte à la volée
 * lors d'un `signInWithOtp`, si bien qu'un onglet unique fabriquerait un compte
 * fantôme à la moindre faute de frappe dans l'adresse — et enverrait un lien de
 * connexion à un inconnu. « Connexion » interdit donc la création
 * (`shouldCreateUser: false`) ; seule l'inscription l'autorise, après
 * acceptation explicite des conditions.
 */

type Mode = "signin" | "signup";
type Status = "idle" | "sending" | "sent" | "error";

/**
 * N'accepte qu'un chemin interne. Le paramètre vient de l'URL, donc de
 * n'importe qui : un `next` absolu transformerait notre propre lien de
 * connexion en tremplin d'hameçonnage. L'antislash est rejeté car les
 * navigateurs le normalisent en slash — `/\exemple.fr` devient
 * `//exemple.fr`, c'est-à-dire une URL absolue.
 */
function safeNext(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.includes("\\")) return null;
  return value;
}

/** Lien direct vers la webmail de l'utilisateur, quand on sait la reconnaître. */
function webmailUrl(email: string): { href: string; label: string } | null {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (/^(gmail|googlemail)\.com$/.test(domain)) {
    return { href: "https://mail.google.com", label: "Ouvrir Gmail" };
  }
  if (/^(outlook|hotmail|live|msn)\./.test(domain)) {
    return { href: "https://outlook.live.com/mail", label: "Ouvrir Outlook" };
  }
  if (/^(yahoo)\./.test(domain)) {
    return { href: "https://mail.yahoo.com", label: "Ouvrir Yahoo Mail" };
  }
  return null;
}

/**
 * Traduit les erreurs Supabase, qui arrivent en anglais et parfois très
 * techniques. Un message brut comme « Signups not allowed for otp » ne dit rien
 * à l'utilisateur alors qu'il désigne une situation banale : le compte n'existe
 * pas encore.
 */
function humanError(message: string, status: number | undefined, mode: Mode) {
  const raw = message.toLowerCase();

  if (raw.includes("signups not allowed")) {
    return mode === "signin"
      ? "Aucun compte n’existe avec cette adresse. Passe par « Créer un compte »."
      : "La création de compte est momentanément indisponible.";
  }
  if (status === 429 || raw.includes("rate limit") || raw.includes("security purposes")) {
    return "Trop de demandes en peu de temps. Patiente une minute avant de réessayer.";
  }
  if (raw.includes("invalid") && raw.includes("email")) {
    return "Cette adresse e-mail ne semble pas valide.";
  }
  return "L’envoi a échoué. Réessaie dans un instant.";
}

export function AuthPanel() {
  const emailId = useId();
  const termsId = useId();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [terms, setTerms] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  /** Destination voulue, posée par le middleware sur la redirection. */
  function callbackUrl() {
    const url = new URL("/auth/callback", window.location.origin);
    const next = safeNext(
      new URLSearchParams(window.location.search).get("next"),
    );
    if (next) url.searchParams.set("next", next);
    return url.toString();
  }

  function fail(text: string) {
    setStatus("error");
    setMessage(text);
  }

  async function signInWithGoogle() {
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    // En cas de succès le navigateur part chez Google : il n'y a rien à faire
    // ici, l'état « sending » reste affiché jusqu'à la navigation.
    if (error) fail(humanError(error.message, error.status, mode));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (mode === "signup" && !terms) {
      fail("Merci d’accepter les conditions pour créer ton compte.");
      return;
    }

    setStatus("sending");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callbackUrl(),
        shouldCreateUser: mode === "signup",
      },
    });

    if (error) {
      fail(humanError(error.message, error.status, mode));
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    const webmail = webmailUrl(email);

    return (
      <div
        role="status"
        className="flex animate-[ap-up_.4s_ease_both] flex-col gap-4"
      >
        <span className="grid size-[60px] place-items-center rounded-[18px] border border-[rgba(139,124,240,.4)] bg-[rgba(139,124,240,.14)] text-[var(--accent-lighter)] shadow-[0_0_40px_-6px_rgba(139,124,240,.8)]">
          <MailCheck className="size-[26px]" />
        </span>

        <h1 className="m-0 text-[30px] font-bold tracking-[-0.03em]">
          Vérifie ta boîte mail
        </h1>

        <p className="m-0 text-[15px] leading-[1.55] text-[var(--text-dim)]">
          Lien envoyé à{" "}
          <span className="font-medium text-[var(--text)]">{email}</span>. Clique
          dessus pour {mode === "signup" ? "activer ton compte" : "te connecter"}{" "}
          — il expire au bout d’une heure et ne fonctionne qu’une fois.
        </p>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {webmail && (
            <a
              href={webmail.href}
              target="_blank"
              rel="noreferrer noopener"
              className="flex h-[46px] items-center justify-center gap-2 rounded-xl border border-[rgba(255,255,255,.1)] bg-[rgba(255,255,255,.04)] text-sm text-[var(--text)] transition-colors hover:bg-[rgba(255,255,255,.08)] hover:text-white"
            >
              {webmail.label}
              <ExternalLink className="size-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setMessage("");
            }}
            className="h-[46px] rounded-xl border border-[rgba(255,255,255,.1)] text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
          >
            Changer d’adresse
          </button>
        </div>

        <p className="m-0 text-xs leading-[1.55] text-[var(--text-ghost)]">
          Rien reçu au bout de deux minutes ? Regarde dans les indésirables, le
          message vient de <span className="font-mono">no-reply@in.zylax.fr</span>.
        </p>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <div className="flex animate-[ap-up_.5s_ease_both] flex-col gap-[22px]">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[clamp(28px,6vw,34px)] leading-[1.1] font-bold tracking-[-0.035em]">
          {mode === "signin" ? "Bon retour " : "Reprends la main sur "}
          <span className="bg-gradient-to-r from-[#c9c1fa] via-[#8b7cf0] to-[#6f7cf5] bg-clip-text text-transparent">
            {mode === "signin" ? "parmi nous." : "tes abonnements."}
          </span>
        </h1>
        <p className="m-0 text-[15px] leading-[1.5] text-[var(--text-dim)]">
          {mode === "signin"
            ? "Connecte-toi pour retrouver tes abonnements et tes factures."
            : "Crée ton compte en une minute. Gratuit jusqu’à 5 abonnements, sans carte bancaire."}
        </p>
      </div>

      {/* Onglets : `radiogroup` et non `tablist`, parce qu'ils ne révèlent pas
          deux panneaux distincts mais choisissent le comportement d'un même
          formulaire. */}
      <div
        role="radiogroup"
        aria-label="Connexion ou création de compte"
        className="grid grid-cols-2 gap-1 rounded-[14px] border border-[var(--border)] bg-[rgba(255,255,255,.03)] p-1"
      >
        {(
          [
            ["signin", "J’ai un compte"],
            ["signup", "Créer un compte"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => {
              setMode(value);
              setStatus("idle");
              setMessage("");
            }}
            className={`h-10 rounded-[10px] text-sm font-medium transition-colors ${
              mode === value
                ? "bg-[rgba(255,255,255,.09)] text-[var(--text-bright)] shadow-[inset_0_1px_0_rgba(255,255,255,.1)]"
                : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={sending}
        className="flex h-[50px] items-center justify-center gap-2.5 rounded-[14px] border border-[rgba(255,255,255,.12)] bg-[rgba(255,255,255,.05)] text-[15px] font-medium text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,.06)] transition-colors hover:border-[rgba(255,255,255,.2)] hover:bg-[rgba(255,255,255,.09)] disabled:opacity-60"
      >
        <GoogleMark />
        Continuer avec Google
      </button>

      <div className="flex items-center gap-3 text-xs text-[var(--text-ghost)]">
        <span className="h-px flex-1 bg-[rgba(255,255,255,.08)]" />
        ou par e-mail
        <span className="h-px flex-1 bg-[rgba(255,255,255,.08)]" />
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor={emailId} className="text-[13px] text-[var(--text-muted)]">
          Adresse e-mail
        </label>

        <div
          className={`flex h-[50px] items-center gap-2.5 rounded-[14px] border bg-[rgba(255,255,255,.035)] px-3.5 transition-colors focus-within:border-[rgba(139,124,240,.6)] ${
            status === "error"
              ? "border-[rgba(240,113,104,.5)]"
              : "border-[rgba(255,255,255,.1)]"
          }`}
        >
          <Mail className="size-[17px] shrink-0 text-[var(--text-faint)]" />
          <input
            id={emailId}
            type="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (status === "error") setStatus("idle");
            }}
            autoComplete="email"
            // Sur mobile, ces trois attributs évitent la majuscule
            // automatique et le soulignement rouge sur une adresse valide.
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="toi@exemple.fr"
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-[16px] text-[var(--text)] outline-none"
          />
        </div>

        {mode === "signup" && (
          <label
            htmlFor={termsId}
            className="flex cursor-pointer items-start gap-2.5 text-xs leading-[1.5] text-[var(--text-faint)]"
          >
            <input
              id={termsId}
              type="checkbox"
              checked={terms}
              onChange={(event) => {
                setTerms(event.target.checked);
                if (status === "error") setStatus("idle");
              }}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span>
              J’accepte les{" "}
              <Link href="/legal/cgu">conditions d’utilisation</Link> et la{" "}
              <Link href="/legal/confidentialite">
                politique de confidentialité
              </Link>
              .
            </span>
          </label>
        )}

        <button
          type="submit"
          disabled={sending}
          className="flex h-[50px] items-center justify-center gap-2 rounded-[14px] border border-[rgba(201,193,250,.35)] bg-gradient-to-b from-[#8b7cf0] to-[#5b4bd6] text-[15px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(139,124,240,.9),inset_0_1px_0_rgba(255,255,255,.25)] transition-shadow hover:shadow-[0_0_0_4px_rgba(139,124,240,.18),0_14px_40px_-8px_rgba(139,124,240,1),inset_0_1px_0_rgba(255,255,255,.25)] disabled:opacity-70"
        >
          {sending ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Envoi…
            </>
          ) : (
            <>
              {mode === "signin"
                ? "Recevoir un lien de connexion"
                : "Créer mon compte"}
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>

      {status === "error" && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-[rgba(240,113,104,.3)] bg-[rgba(240,113,104,.08)] px-3.5 py-3 text-[13px] text-[var(--danger-light)]"
        >
          <CircleAlert className="mt-px size-4 shrink-0" />
          {message}
        </div>
      )}

      <p className="m-0 text-xs leading-[1.55] text-pretty text-[var(--text-ghost)]">
        Pas de mot de passe : on t’envoie un lien sécurisé, valable une heure et
        une seule fois.{" "}
        {mode === "signin" && (
          <>
            En continuant, tu acceptes nos{" "}
            <Link href="/legal/cgu">conditions</Link> et notre{" "}
            <Link href="/legal/confidentialite">
              politique de confidentialité
            </Link>
            .
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Pastille Google. Dessinée en SVG plutôt qu'en image : pas de requête
 * supplémentaire, et le rendu reste net à toutes les densités d'écran.
 */
function GoogleMark() {
  return (
    <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-white">
      <svg viewBox="0 0 48 48" className="size-3.5" aria-hidden>
        <path
          fill="#4285F4"
          d="M45 24c0-1.6-.1-2.7-.4-3.9H24v7.1h12c-.2 1.9-1.5 4.7-4.4 6.6l6.8 5.3C42.3 35.6 45 30.3 45 24z"
        />
        <path
          fill="#34A853"
          d="M24 46c5.9 0 10.9-2 14.4-5.3l-6.8-5.3c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7 5.4C8 41.1 15.4 46 24 46z"
        />
        <path
          fill="#FBBC05"
          d="M11.5 28.5c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5l-7-5.4C3.3 17.1 2.5 20.4 2.5 24s.8 6.9 2 9.9l7-5.4z"
        />
        <path
          fill="#EA4335"
          d="M24 10.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.3 29.9 2 24 2 15.4 2 8 6.9 4.5 14.1l7 5.4c1.8-5.3 6.7-9 12.5-9z"
        />
      </svg>
    </span>
  );
}
