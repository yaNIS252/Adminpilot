"use client";

import Link from "next/link";
import { useId, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  CircleAlert,
  ExternalLink,
  Mail,
  MailCheck,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

/**
 * Connexion Google : affichée seulement une fois le fournisseur configuré dans
 * Supabase (client OAuth Google Cloud). Tant qu'il ne l'est pas, le bouton
 * menait à une page d'erreur — pire que pas de bouton du tout.
 */
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1";

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

  // Supabase distingue deux limitations, et les confondre envoie l'utilisateur
  // attendre une minute là où il devra patienter une heure.
  //
  // « For security purposes… after N seconds » : délai minimal entre deux
  // demandes pour une même adresse. Le nombre est dans le message, on le reprend
  // plutôt que d'annoncer une durée inventée.
  const delay = /after (\d+) seconds?/.exec(raw)?.[1];
  if (delay) {
    return `Une demande vient déjà d’être envoyée. Réessaie dans ${delay} secondes.`;
  }

  // « email rate limit exceeded » : plafond horaire du service d'envoi. Rien à
  // voir avec un abus de la part de l'utilisateur, d'où un message qui ne le
  // met pas en cause.
  if (raw.includes("rate limit") || status === 429) {
    return GOOGLE_ENABLED
      ? "Le service d’envoi d’e-mails a atteint sa limite horaire. Réessaie dans une heure, ou connecte-toi avec Google."
      : "Le service d’envoi d’e-mails a atteint sa limite horaire. Réessaie dans une heure.";
  }

  if (raw.includes("invalid") && raw.includes("email")) {
    return "Cette adresse e-mail ne semble pas valide.";
  }

  // « Error sending magic link email » : la demande est bonne, c'est le
  // service d'envoi qui a refusé (domaine d'expédition non vérifié, SMTP mal
  // configuré). Réessayer ne changera rien tant que ce n'est pas réparé :
  // mieux vaut le dire que laisser l'utilisateur insister.
  if (raw.includes("error sending") || (status !== undefined && status >= 500)) {
    return "Notre service d’envoi d’e-mails rencontre un problème de notre côté. Réessaie un peu plus tard.";
  }
  return "L’envoi a échoué. Réessaie dans un instant.";
}

/**
 * Message d'un échec survenu APRÈS le clic sur le lien reçu par e-mail.
 *
 * Ces erreurs arrivent par l'URL (`/login?error=…`, posé par le callback ou
 * par le middleware) et n'étaient jamais affichées : l'utilisateur revenait sur
 * un formulaire vierge, sans savoir que son lien avait échoué ni pourquoi.
 */
function linkErrorMessage(code: string): string {
  switch (code) {
    case "otp_expired":
      return "Ce lien a expiré ou a déjà servi. Chaque nouvelle demande annule les précédentes : utilise toujours le dernier e-mail reçu, ou demande un nouveau lien.";
    case "jeton_manquant":
      return "Ce lien de connexion est incomplet. Demande-en un nouveau.";
    case "session_expiree":
      return "Par sécurité, ta session a expiré (30 jours, ou 14 jours sans visite). Reconnecte-toi avec un nouveau lien.";
    default:
      return "La connexion par ce lien a échoué. Demande un nouveau lien, en l’ouvrant dans le même navigateur que celui où tu l’as demandé.";
  }
}

/** L'URL ne change pas sous nos pieds : aucun abonnement nécessaire. */
function noopSubscribe() {
  return () => {};
}

export function AuthPanel() {
  const emailId = useId();
  const termsId = useId();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [terms, setTerms] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  // Erreur transmise par l'URL après un lien raté. `useSyncExternalStore`
  // plutôt qu'un état initialisé depuis `window` : la page est rendue
  // statiquement, le serveur ne connaît pas la requête, et l'instantané serveur
  // `null` évite tout écart d'hydratation.
  const urlError = useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("error"),
    () => null,
  );
  const [urlErrorDismissed, setUrlErrorDismissed] = useState(false);

  const shownError =
    status === "error"
      ? message
      : urlError && !urlErrorDismissed
        ? linkErrorMessage(urlError)
        : null;

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
    setUrlErrorDismissed(true);
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
    setUrlErrorDismissed(true);

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
        <MailCheck className="size-7 text-[var(--accent-lighter)]" />

        <h1 className="serif m-0 text-[40px] leading-[1.02]">
          Vérifie ta <em>boîte mail.</em>
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
              className="btn-primary h-11 text-sm"
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
            className="btn-secondary h-11 text-sm"
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
        <h1 className="serif m-0 text-[clamp(38px,8vw,48px)] leading-[1.02]">
          {mode === "signin" ? "Bon retour " : "Reprends la main sur "}
          <em>{mode === "signin" ? "parmi nous." : "tes abonnements."}</em>
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
        className="grid grid-cols-2 gap-1 rounded-[10px] border border-[var(--border)] p-1"
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
            className={`h-9 rounded-[7px] text-sm font-medium transition-colors ${
              mode === value
                ? "bg-[var(--paper)] text-[var(--ink)]"
                : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {GOOGLE_ENABLED && (
        <>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={sending}
            className="btn-secondary h-12 gap-2.5 text-[15px] disabled:opacity-60"
          >
            <GoogleMark />
            Continuer avec Google
          </button>

          <div className="flex items-center gap-3 text-xs text-[var(--text-ghost)]">
            <span className="h-px flex-1 bg-[rgba(255,255,255,.08)]" />
            ou par e-mail
            <span className="h-px flex-1 bg-[rgba(255,255,255,.08)]" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor={emailId} className="text-[13px] text-[var(--text-muted)]">
          Adresse e-mail
        </label>

        <div
          className={`flex h-12 items-center gap-2.5 rounded-[8px] border bg-[rgba(255,255,255,.02)] px-3.5 transition-colors focus-within:border-[var(--text-faint)] ${
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
          className="btn-primary h-12 text-[15px] disabled:opacity-70"
        >
          {sending ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-[rgba(22,20,31,.25)] border-t-[var(--ink)]" />
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

      {shownError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-[rgba(240,113,104,.3)] bg-[rgba(240,113,104,.08)] px-3.5 py-3 text-[13px] text-[var(--danger-light)]"
        >
          <CircleAlert className="mt-px size-4 shrink-0" />
          {shownError}
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
