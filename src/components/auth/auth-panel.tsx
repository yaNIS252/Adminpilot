"use client";

import Link from "next/link";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff, KeyRound, Mail, MailCheck } from "lucide-react";

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
 * Tout se passe sur cette page : mot de passe, ou code à 6 chiffres reçu par
 * e-mail et tapé ici. L'ancien lien magique ouvrait un nouvel onglet à chaque
 * connexion et, sur téléphone, sortait de l'application installée.
 *
 * Les messages ne disent jamais si une adresse a déjà un compte : « code
 * envoyé si un compte existe », « identifiants incorrects ». Sinon le
 * formulaire servirait à dresser la liste de nos clients.
 */

type Mode = "signin" | "signup";
type Method = "password" | "code";
/** Étape du parcours, toujours sur cette même page. */
type Step = "form" | "code" | "reset-request" | "reset";
type Status = "idle" | "busy" | "error";

const RESEND_COOLDOWN_S = 60;
const MIN_PASSWORD = 8;

/**
 * N'accepte qu'un chemin interne. Le paramètre vient de l'URL, donc de
 * n'importe qui : un `next` absolu transformerait notre propre page de
 * connexion en tremplin d'hameçonnage. L'antislash est rejeté car les
 * navigateurs le normalisent en slash — `/\exemple.fr` devient
 * `//exemple.fr`, c'est-à-dire une URL absolue.
 */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//") || value.includes("\\")) return "/dashboard";
  return value;
}

/**
 * Traduit les erreurs Supabase (en anglais, parfois techniques), sans jamais
 * révéler si une adresse est inscrite.
 */
function humanError(message: string, status?: number): string {
  const raw = message.toLowerCase();
  const delay = /after (\d+) seconds?/.exec(raw)?.[1];
  if (delay) return `Une demande vient déjà d’être envoyée. Réessaie dans ${delay} secondes.`;
  if (raw.includes("rate limit") || status === 429) {
    return "Trop de tentatives. Patiente quelques minutes avant de réessayer.";
  }
  if (raw.includes("invalid login credentials")) return "Adresse ou mot de passe incorrect.";
  if (raw.includes("email not confirmed")) {
    return "Adresse pas encore confirmée : connecte-toi avec un code par e-mail pour la valider.";
  }
  if (raw.includes("token") && (raw.includes("expired") || raw.includes("invalid"))) {
    return "Code incorrect ou expiré. Vérifie le dernier e-mail reçu, ou demande un nouveau code.";
  }
  if (raw.includes("password") && (raw.includes("weak") || raw.includes("at least") || raw.includes("characters"))) {
    return `Mot de passe trop faible : au moins ${MIN_PASSWORD} caractères, mélange lettres et chiffres.`;
  }
  if (raw.includes("same") && raw.includes("password")) {
    return "Choisis un mot de passe différent de l’ancien.";
  }
  if (raw.includes("invalid") && raw.includes("email")) return "Cette adresse e-mail ne semble pas valide.";
  if (raw.includes("error sending") || (status !== undefined && status >= 500)) {
    return "Notre service d’envoi d’e-mails rencontre un problème. Réessaie un peu plus tard.";
  }
  return "Ça n’a pas fonctionné. Réessaie dans un instant.";
}

/** Erreurs posées dans l'URL (`/login?error=…`) par le callback Google ou le middleware. */
function urlErrorMessage(code: string): string {
  switch (code) {
    case "session_expiree":
      return "Par sécurité, ta session a expiré (30 jours, ou 14 jours sans visite). Reconnecte-toi.";
    case "otp_expired":
      return "Ce lien a expiré ou a déjà servi. Connecte-toi avec ton mot de passe ou un code.";
    default:
      return "La connexion a échoué. Réessaie.";
  }
}

/** Force d'un mot de passe, de 0 à 4 : longueur et variété des caractères. */
function passwordScore(value: string): number {
  if (value.length < MIN_PASSWORD) return value ? 1 : 0;
  let score = 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  else if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score += 0.5;
  return Math.min(4, Math.floor(score));
}

const SCORE_LABELS = ["", "Trop court", "Correct", "Solide", "Très solide"];

function noopSubscribe() {
  return () => {};
}

export function AuthPanel({
  initialMode = "signin",
  referred = false,
}: {
  initialMode?: Mode;
  /** Arrivée par un lien de parrainage : le mois offert est annoncé. */
  referred?: boolean;
} = {}) {
  const ids = { email: useId(), password: useId(), code: useId(), terms: useId() };

  const [mode, setMode] = useState<Mode>(initialMode);
  const [method, setMethod] = useState<Method>("password");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [terms, setTerms] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [info, setInfo] = useState("");
  /** Type de code attendu : connexion, confirmation d'inscription. */
  const [codeType, setCodeType] = useState<"email" | "signup">("email");
  const [cooldown, setCooldown] = useState(0);

  const urlError = useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("error"),
    () => null,
  );
  const [urlErrorDismissed, setUrlErrorDismissed] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const shownError =
    status === "error" ? message : urlError && !urlErrorDismissed ? urlErrorMessage(urlError) : null;
  const busy = status === "busy";

  function next(): string {
    return safeNext(new URLSearchParams(window.location.search).get("next"));
  }

  function fail(text: string) {
    setStatus("error");
    setMessage(text);
  }

  function reset(nextStep: Step = "form") {
    setStep(nextStep);
    setStatus("idle");
    setMessage("");
    setInfo("");
    setCode("");
  }

  /** Session ouverte côté navigateur : le serveur la finalise, puis on repart. */
  async function finish() {
    await fetch("/api/auth/session", { method: "POST" }).catch(() => null);
    window.location.assign(next());
  }

  async function signInWithGoogle() {
    setUrlErrorDismissed(true);
    setStatus("busy");
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", next());
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: url.toString() },
    });
    if (error) fail(humanError(error.message, error.status));
  }

  /** Envoie un code de connexion (ou de création de compte). */
  async function sendCode(): Promise<boolean> {
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: mode === "signup" },
    });
    // « Signups not allowed » : l'adresse n'a pas de compte. On fait comme si
    // le code était parti, pour ne rien révéler ; la vérification échouera.
    if (error && !error.message.toLowerCase().includes("signups not allowed")) {
      fail(humanError(error.message, error.status));
      return false;
    }
    setCooldown(RESEND_COOLDOWN_S);
    return true;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setUrlErrorDismissed(true);
    if (mode === "signup" && !terms) return fail("Merci d’accepter les conditions pour créer ton compte.");
    setStatus("busy");
    const supabase = createClient();

    if (method === "code") {
      if (!(await sendCode())) return;
      setCodeType("email");
      reset("code");
      setInfo(
        mode === "signup"
          ? "Code envoyé. Il expire au bout d’une heure."
          : "Si un compte existe avec cette adresse, un code vient d’y être envoyé.",
      );
      return;
    }

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return fail(humanError(error.message, error.status));
      return finish();
    }

    if (password.length < MIN_PASSWORD) {
      return fail(`Ton mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`);
    }
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) return fail(humanError(error.message, error.status));
    // Confirmation désactivée côté Supabase : la session est déjà ouverte.
    if (data.session) return finish();
    setCodeType("signup");
    setCooldown(RESEND_COOLDOWN_S);
    reset("code");
    setInfo("Pour confirmer ton adresse, entre le code qu’on vient de t’envoyer.");
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setStatus("busy");
    const { error } = await createClient().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: codeType,
    });
    if (error) return fail(humanError(error.message, error.status));
    return finish();
  }

  async function resend() {
    setStatus("busy");
    const supabase = createClient();
    if (step === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) return fail(humanError(error.message, error.status));
      setCooldown(RESEND_COOLDOWN_S);
    } else if (codeType === "signup") {
      const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
      if (error) return fail(humanError(error.message, error.status));
      setCooldown(RESEND_COOLDOWN_S);
    } else if (!(await sendCode())) {
      return;
    }
    setStatus("idle");
    setMessage("");
    setInfo("Nouveau code envoyé. Seul le dernier reçu fonctionne.");
  }

  async function requestReset(event: React.FormEvent) {
    event.preventDefault();
    setStatus("busy");
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim());
    // Seule la limite d'envoi est signalée ; toute autre erreur (adresse
    // inconnue…) reçoit la même réponse qu'un succès, pour ne rien révéler.
    if (error && (error.status === 429 || /after \d+ seconds?/i.test(error.message))) {
      return fail(humanError(error.message, error.status));
    }
    setCooldown(RESEND_COOLDOWN_S);
    reset("reset");
    setPassword("");
    setInfo("Si un compte existe avec cette adresse, un code vient d’y être envoyé.");
  }

  async function confirmReset(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) {
      return fail(`Ton mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`);
    }
    setStatus("busy");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "recovery",
    });
    if (error) return fail(humanError(error.message, error.status));
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) return fail(humanError(updateError.message, updateError.status));
    return finish();
  }

  const errorBox = shownError && (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-[rgba(240,113,104,.3)] bg-[rgba(240,113,104,.08)] px-3.5 py-3 text-[13px] text-[var(--danger-light)]"
    >
      <CircleAlert className="mt-px size-4 shrink-0" />
      {shownError}
    </div>
  );

  const submitButton = (label: string) => (
    <button type="submit" disabled={busy} className="btn-primary h-12 text-[15px] disabled:opacity-70">
      {busy ? (
        <>
          <span className="size-4 animate-spin rounded-full border-2 border-[rgba(22,20,31,.25)] border-t-[var(--ink)]" />
          Un instant…
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="size-4" />
        </>
      )}
    </button>
  );

  const resendButton = (
    <button
      type="button"
      onClick={resend}
      disabled={busy || cooldown > 0}
      className="text-[13px] text-[var(--accent-lighter)] disabled:text-[var(--text-faint)]"
    >
      {cooldown > 0 ? `Renvoyer le code (${cooldown} s)` : "Renvoyer le code"}
    </button>
  );

  const backButton = (
    <button
      type="button"
      onClick={() => reset("form")}
      className="flex items-center gap-1.5 self-start text-[13px] text-[var(--text-dim)] hover:text-[var(--text)]"
    >
      <ArrowLeft className="size-4" />
      Retour
    </button>
  );

  // ------------------------------------------------- saisie du code reçu
  if (step === "code" || step === "reset") {
    const resetting = step === "reset";
    return (
      <div className="flex animate-[ap-up_.4s_ease_both] flex-col gap-4">
        {backButton}
        <MailCheck className="size-7 text-[var(--accent-lighter)]" />
        <h1 className="serif m-0 text-[clamp(34px,8vw,40px)] leading-[1.02]">
          {resetting ? "Nouveau " : "Entre ton "}
          <em>{resetting ? "mot de passe." : "code."}</em>
        </h1>
        <p className="m-0 text-[15px] leading-[1.55] text-[var(--text-dim)]">
          {info} Envoyé à <span className="font-medium text-[var(--text)]">{email}</span>.
        </p>
        <form onSubmit={resetting ? confirmReset : verify} className="flex flex-col gap-3">
          <label htmlFor={ids.code} className="text-[13px] text-[var(--text-muted)]">
            Code reçu par e-mail
          </label>
          <input
            id={ids.code}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 8));
              if (status === "error") setStatus("idle");
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            minLength={6}
            placeholder="123456"
            className="h-12 rounded-[8px] border border-[rgba(255,255,255,.1)] bg-[rgba(255,255,255,.02)] px-3.5 text-center font-mono text-[22px] tracking-[.4em] text-[var(--text)] outline-none focus:border-[var(--text-faint)]"
          />
          {resetting && (
            <PasswordField
              id={ids.password}
              label="Nouveau mot de passe"
              value={password}
              onChange={setPassword}
              show={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
              autoComplete="new-password"
              strength
            />
          )}
          {submitButton(resetting ? "Changer mon mot de passe" : "Valider")}
        </form>
        {resendButton}
        {errorBox}
        <p className="m-0 text-xs leading-[1.55] text-[var(--text-ghost)]">
          Rien reçu ? Regarde dans les indésirables : le message vient de{" "}
          <span className="font-mono">connexion@in.zylax.fr</span>.
        </p>
      </div>
    );
  }

  // ------------------------------------------- mot de passe oublié
  if (step === "reset-request") {
    return (
      <div className="flex animate-[ap-up_.4s_ease_both] flex-col gap-4">
        {backButton}
        <KeyRound className="size-7 text-[var(--accent-lighter)]" />
        <h1 className="serif m-0 text-[clamp(34px,8vw,40px)] leading-[1.02]">
          Mot de passe <em>oublié.</em>
        </h1>
        <p className="m-0 text-[15px] leading-[1.55] text-[var(--text-dim)]">
          On t’envoie un code par e-mail, puis tu choisis un nouveau mot de passe ici.
        </p>
        <form onSubmit={requestReset} className="flex flex-col gap-3">
          <EmailField id={ids.email} value={email} onChange={setEmail} error={status === "error"} />
          {submitButton("Recevoir un code")}
        </form>
        {errorBox}
      </div>
    );
  }

  // ------------------------------------------------- formulaire principal
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
            : "Crée ton compte en une minute : 14 jours de Pro offerts, sans carte bancaire. Ensuite, gratuit jusqu’à 5 abonnements."}
        </p>
      </div>

      {referred && mode === "signup" && (
        <p
          role="status"
          className="m-0 rounded-[10px] border border-[rgb(var(--accent-rgb)/.35)] bg-[var(--accent-soft)] px-4 py-3 text-[13px] leading-[1.55] text-[var(--text-dim)]"
        >
          <strong className="text-[var(--text)]">Un proche t’offre 1 mois de Pro.</strong> Il
          s’active tout seul dès que le transfert de tes e-mails est en place, sans carte bancaire.
        </p>
      )}

      <Segmented
        label="Connexion ou création de compte"
        value={mode}
        options={[
          ["signin", "J’ai un compte"],
          ["signup", "Créer un compte"],
        ]}
        onChange={(value) => {
          setMode(value);
          reset("form");
        }}
      />

      {GOOGLE_ENABLED && (
        <>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
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

      <Segmented
        label="Méthode"
        small
        value={method}
        options={[
          ["password", "Mot de passe"],
          ["code", "Code par e-mail"],
        ]}
        onChange={(value) => {
          setMethod(value);
          setStatus("idle");
        }}
      />

      <form onSubmit={submit} className="flex flex-col gap-3">
        <EmailField
          id={ids.email}
          value={email}
          onChange={(value) => {
            setEmail(value);
            if (status === "error") setStatus("idle");
          }}
          error={status === "error"}
        />

        {method === "password" && (
          <>
            <PasswordField
              id={ids.password}
              label="Mot de passe"
              value={password}
              onChange={(value) => {
                setPassword(value);
                if (status === "error") setStatus("idle");
              }}
              show={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              strength={mode === "signup"}
            />
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => reset("reset-request")}
                className="self-end text-[13px] text-[var(--text-dim)] hover:text-[var(--text)]"
              >
                Mot de passe oublié ?
              </button>
            )}
          </>
        )}

        {mode === "signup" && (
          <label
            htmlFor={ids.terms}
            className="flex cursor-pointer items-start gap-2.5 text-xs leading-[1.5] text-[var(--text-faint)]"
          >
            <input
              id={ids.terms}
              type="checkbox"
              checked={terms}
              onChange={(event) => {
                setTerms(event.target.checked);
                if (status === "error") setStatus("idle");
              }}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span>
              J’accepte les <Link href="/legal/cgu">conditions d’utilisation</Link> et la{" "}
              <Link href="/legal/confidentialite">politique de confidentialité</Link>.
            </span>
          </label>
        )}

        {submitButton(
          method === "code"
            ? "Recevoir un code"
            : mode === "signin"
              ? "Se connecter"
              : "Créer mon compte",
        )}
      </form>

      {errorBox}

      <p className="m-0 text-xs leading-[1.55] text-pretty text-[var(--text-ghost)]">
        {method === "code"
          ? "Un code à 6 chiffres arrive par e-mail : tu le tapes ici, sans quitter la page. "
          : ""}
        {mode === "signin" && (
          <>
            En continuant, tu acceptes nos <Link href="/legal/cgu">conditions</Link> et notre{" "}
            <Link href="/legal/confidentialite">politique de confidentialité</Link>.
          </>
        )}
      </p>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  small = false,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
  small?: boolean;
}) {
  // `radiogroup` et non `tablist` : on choisit le comportement d'un même
  // formulaire, on ne révèle pas deux panneaux distincts.
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-2 gap-1 rounded-[10px] border border-[var(--border)] p-1"
    >
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={`${small ? "h-8 text-[13px]" : "h-9 text-sm"} rounded-[7px] font-medium transition-colors ${
            value === option
              ? small
                ? "bg-[rgba(255,255,255,.08)] text-[var(--text)]"
                : "bg-[var(--paper)] text-[var(--ink)]"
              : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function EmailField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error: boolean;
}) {
  return (
    <>
      <label htmlFor={id} className="text-[13px] text-[var(--text-muted)]">
        Adresse e-mail
      </label>
      <div
        className={`flex h-12 items-center gap-2.5 rounded-[8px] border bg-[rgba(255,255,255,.02)] px-3.5 transition-colors focus-within:border-[var(--text-faint)] ${
          error ? "border-[rgba(240,113,104,.5)]" : "border-[rgba(255,255,255,.1)]"
        }`}
      >
        <Mail className="size-[17px] shrink-0 text-[var(--text-faint)]" />
        <input
          id={id}
          type="email"
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="email"
          // Sur mobile : pas de majuscule automatique ni de soulignement rouge.
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="toi@exemple.fr"
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-[16px] text-[var(--text)] outline-none"
        />
      </div>
    </>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  strength = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
  strength?: boolean;
}) {
  const score = passwordScore(value);
  return (
    <>
      <label htmlFor={id} className="text-[13px] text-[var(--text-muted)]">
        {label}
      </label>
      <div className="flex h-12 items-center gap-2.5 rounded-[8px] border border-[rgba(255,255,255,.1)] bg-[rgba(255,255,255,.02)] pr-1.5 pl-3.5 focus-within:border-[var(--text-faint)]">
        <KeyRound className="size-[17px] shrink-0 text-[var(--text-faint)]" />
        <input
          id={id}
          type={show ? "text" : "password"}
          required
          minLength={strength ? MIN_PASSWORD : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-[16px] text-[var(--text)] outline-none"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          title={show ? "Masquer" : "Afficher"}
          className="grid size-9 place-items-center rounded-md text-[var(--text-faint)] hover:text-[var(--text)]"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {strength && value && (
        <div className="flex items-center gap-2.5" aria-live="polite">
          <div className="grid flex-1 grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((level) => (
              <span
                key={level}
                className={`h-1 rounded-full ${
                  level <= score
                    ? score <= 1
                      ? "bg-[var(--danger)]"
                      : score === 2
                        ? "bg-[var(--warning)]"
                        : "bg-[var(--positive)]"
                    : "bg-[rgba(255,255,255,.08)]"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-[var(--text-faint)]">{SCORE_LABELS[score]}</span>
        </div>
      )}
    </>
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
