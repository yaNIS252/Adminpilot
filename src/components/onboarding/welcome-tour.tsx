"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bell, Check, FileText, Gift, Mail, Wallet, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { LogoMark } from "@/components/marketing/logo-mark";
import { useGmailConfirmation, type GmailConfirmation } from "@/components/onboarding/use-gmail-confirmation";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { ShareActions } from "@/components/referral/share-actions";
import { ForwardingSetup, type Mailbox } from "@/components/shared/forwarding-setup";
import { HistoryImport } from "@/components/shared/history-import";
import { InboxAddress } from "@/components/shared/inbox-address";
import { useIsPhone } from "@/components/shared/use-is-phone";
import { createClient } from "@/lib/supabase/client";

/**
 * Présentation de bienvenue : une fenêtre par-dessus l'application, floutée
 * derrière, à la première connexion.
 *
 * Bienvenue → profil → messagerie → transfert → parrainage. Tant qu'elle
 * n'est pas terminée, elle revient à chaque nouvelle connexion, à l'étape où
 * l'utilisateur s'était arrêté. La refermer ne la fait taire que jusqu'à la
 * prochaine connexion : on la relie à l'horodatage de la session en cours.
 *
 * D'autres écrans peuvent la rouvrir à une étape précise avec
 * `openWelcomeTour(étape)` (par exemple « Brancher ma boîte mail »).
 */

// L'ordre compte : `TOUR_MAILBOX_STEP` (constants) désigne « Messagerie ».
const STEPS = ["Bienvenue", "Profil", "Messagerie", "Transfert", "Parrainage"] as const;
const STEP_KEY = "ap_tour_step";
const DISMISS_KEY = "ap_tour_dismissed";
const OPEN_EVENT = "ap:open-tour";

export function openWelcomeTour(step = 0) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: step }));
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible (navigation privée) : la présentation reviendra
    // simplement plus souvent.
  }
}

function noopSubscribe() {
  return () => {};
}

export function WelcomeTour(props: {
  userId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  address: string;
  domains: string[];
  initialConfirmation: GmailConfirmation | null;
  referralLink: string;
  completed: boolean;
  /** Identifie la connexion en cours (début de session). */
  sessionKey: string;
}) {
  // Refermée pendant cette connexion ? Lu côté navigateur seulement : le
  // serveur rend la page sans la fenêtre, puis elle apparaît si besoin.
  const dismissedThisSession = useSyncExternalStore(
    noopSubscribe,
    () => readStorage(DISMISS_KEY) === props.sessionKey,
    () => true,
  );
  const [closed, setClosed] = useState(false);
  const [forcedStep, setForcedStep] = useState<number | null>(null);

  useEffect(() => {
    function onOpen(event: Event) {
      setForcedStep((event as CustomEvent<number>).detail ?? 0);
      setClosed(false);
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const open = forcedStep !== null || (!props.completed && !dismissedThisSession && !closed);
  if (!open) return null;

  return (
    <TourDialog
      {...props}
      startStep={forcedStep}
      onClose={() => {
        writeStorage(DISMISS_KEY, props.sessionKey);
        setForcedStep(null);
        setClosed(true);
      }}
      onFinish={() => {
        writeStorage(STEP_KEY, null);
        setForcedStep(null);
        setClosed(true);
      }}
    />
  );
}

function TourDialog({
  userId,
  email,
  name,
  avatarUrl,
  address,
  domains,
  initialConfirmation,
  referralLink,
  startStep,
  onClose,
  onFinish,
}: Parameters<typeof WelcomeTour>[0] & {
  startStep: number | null;
  onClose: () => void;
  onFinish: () => void;
}) {
  const router = useRouter();
  // Monté côté navigateur uniquement : on peut lire l'étape mémorisée.
  const [step, setStep] = useState(() => {
    if (startStep !== null) return startStep;
    const saved = Number(readStorage(STEP_KEY));
    return Number.isInteger(saved) && saved >= 0 && saved < STEPS.length ? saved : 0;
  });
  const [mailbox, setMailbox] = useState<Mailbox>(() =>
    /@(gmail|googlemail)\./i.test(email) ? "gmail" : /@(outlook|hotmail|live|msn)\./i.test(email) ? "outlook" : "gmail",
  );
  const [saving, setSaving] = useState(false);
  const confirmation = useGmailConfirmation(userId, initialConfirmation);
  const phone = useIsPhone();

  function go(next: number) {
    setStep(next);
    writeStorage(STEP_KEY, String(next));
  }

  // Échap ferme, comme toute fenêtre.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function confirmForwarding() {
    setSaving(true);
    await createClient().from("profiles").update({ gmail_forward_verified: true }).eq("id", userId);
    setSaving(false);
    router.refresh();
    go(step + 1);
  }

  async function finish() {
    setSaving(true);
    await createClient()
      .from("profiles")
      .update({ tour_completed_at: new Date().toISOString() })
      .eq("id", userId);
    setSaving(false);
    onFinish();
    router.refresh();
  }

  const last = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(5,5,10,.55)] p-4 backdrop-blur-md"
    >
      <div className="relative flex max-h-[92dvh] w-full max-w-[580px] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg)] shadow-[0_30px_80px_rgba(0,0,0,.5)]">
        <header className="flex items-center gap-3 border-b border-[var(--border-soft)] px-5 py-3.5">
          <ol className="m-0 flex flex-1 list-none gap-1.5 p-0" aria-label="Étapes">
            {STEPS.map((label, index) => (
              <li
                key={label}
                aria-current={index === step ? "step" : undefined}
                title={label}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  index <= step ? "bg-[var(--accent)]" : "bg-[rgba(255,255,255,.08)]"
                }`}
              />
            ))}
          </ol>
          <span className="mono shrink-0 text-[11px] text-[var(--text-faint)]">
            {step + 1}/{STEPS.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer, je verrai plus tard"
            title="Plus tard"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[rgba(255,255,255,.06)] hover:text-[var(--text)]"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="overflow-y-auto px-6 py-6">
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <LogoMark size={44} />
              <div>
                <h2 id="tour-title" className="serif m-0 text-[34px] leading-[1.05]">
                  Bienvenue{name ? <em>{` ${name.split(" ")[0]}`}</em> : null}.
                </h2>
                <p className="m-0 mt-2 text-[15px] leading-[1.6] text-[var(--text-dim)]">
                  AdminPilot lit les factures que tu lui transfères et s’occupe
                  du reste. Deux minutes de mise en place, puis plus rien à faire.
                </p>
              </div>
              <ul className="m-0 flex list-none flex-col gap-3 p-0 text-sm">
                <Benefit icon={<Wallet className="size-4" />} title="Tous tes abonnements au même endroit">
                  Montants, échéances, total par mois : détectés tout seuls.
                </Benefit>
                <Benefit icon={<Bell className="size-4" />} title="Prévenu avant chaque prélèvement">
                  Et dès qu’un prix augmente.
                </Benefit>
                <Benefit icon={<FileText className="size-4" />} title="Tes documents rangés et retrouvables">
                  Factures, contrats, avis : classés et renommés.
                </Benefit>
              </ul>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-5">
              <StepTitle title="Comment t’appelles-tu ?">
                Ton prénom et ta photo s’affichent dans l’application. Les deux
                sont facultatifs.
              </StepTitle>
              <ProfileEditor email={email} initialName={name} avatarUrl={avatarUrl} saveOnBlur />
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <StepTitle title="Quelle messagerie utilises-tu ?">
                On t’explique pas à pas comment y brancher AdminPilot. Aucun
                accès à ta boîte, aucun mot de passe : tu transfères, on lit.
              </StepTitle>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {(
                  [
                    ["gmail", "Gmail"],
                    ["outlook", "Outlook / Hotmail"],
                    ["autre", "Autre"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMailbox(id)}
                    aria-pressed={mailbox === id}
                    className={`flex items-center justify-between gap-2 rounded-[10px] border px-4 py-3.5 text-left text-sm font-medium transition-colors ${
                      mailbox === id
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Mail className="size-4 text-[var(--accent-light)]" />
                      {label}
                    </span>
                    {mailbox === id && <Check className="size-4 text-[var(--accent-light)]" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-5">
              {mailbox === "gmail" ? (
                <>
                  <StepTitle title="Branche Gmail">
                    {phone
                      ? "L’application Gmail n’a pas ces réglages : ouvre mail.google.com dans ton navigateur, puis menu ⋮ (ou « aA » sur iPhone) → Version pour ordinateur."
                      : "Trois gestes, et tes factures arriveront toutes seules."}
                  </StepTitle>
                  <Numbered n={1} title="Copie ton adresse AdminPilot">
                    <InboxAddress address={address} />
                  </Numbered>
                  <Numbered n={2} title="Ajoute-la comme adresse de transfert">
                    <p className="m-0 text-sm leading-[1.7] text-[var(--text-dim)]">
                      Gmail : roue dentée → <strong className="text-[var(--text)]">Voir tous les paramètres</strong> →{" "}
                      <strong className="text-[var(--text)]">Transfert et POP/IMAP</strong> →{" "}
                      <strong className="text-[var(--text)]">Ajouter une adresse de transfert</strong>. Colle l’adresse et valide.
                    </p>
                    {confirmation ? (
                      <div className="mt-3 rounded-[10px] border border-[rgb(var(--accent-rgb)/.4)] bg-[var(--accent-soft)] p-4">
                        <p className="m-0 mb-2 text-sm text-[var(--text-dim)]">
                          Gmail vient d’envoyer son code de confirmation :
                        </p>
                        <div className="mono text-[28px] font-semibold tracking-[0.12em] text-[var(--text-bright)]">
                          {confirmation.code}
                        </div>
                        {confirmation.url && (
                          <a
                            href={confirmation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary mt-3 h-9 px-3.5 text-[13px]"
                          >
                            Confirmer directement chez Google
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="m-0 mt-3 flex items-start gap-2.5 text-[13px] leading-[1.6] text-[var(--text-faint)]">
                        <span className="mt-[7px] size-1.5 shrink-0 animate-[ap-dot_2s_infinite] rounded-full bg-[var(--accent-light)]" />
                        Gmail va envoyer un code de confirmation. Il arrive chez
                        nous et s’affichera ici tout seul.
                      </p>
                    )}
                  </Numbered>
                  <Numbered n={3} title="Rends le transfert automatique">
                    <ForwardingSetup address={address} domains={domains} mailbox="gmail" />
                  </Numbered>
                  <Numbered n={4} title="Récupère tes anciennes factures (facultatif)" last>
                    <HistoryImport address={address} domains={domains} />
                  </Numbered>
                </>
              ) : (
                <>
                  <StepTitle title={mailbox === "outlook" ? "Branche Outlook" : "Branche ta messagerie"}>
                    Une règle de transfert, créée une fois, et chaque nouvelle
                    facture arrive toute seule.
                  </StepTitle>
                  <ForwardingSetup address={address} domains={domains} mailbox={mailbox} />
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-5">
              <span className="grid size-11 place-items-center rounded-full bg-[rgb(var(--accent-rgb)/.16)] text-[var(--accent-lighter)]">
                <Gift className="size-5" />
              </span>
              <StepTitle title="Offre 1 mois de Pro à tes proches">
                Chaque proche qui s’inscrit avec ton lien reçoit 1 mois de Pro.
                Quand il s’en sert, tu reçois toi aussi 1 mois offert, jusqu’à
                12 mois.
              </StepTitle>
              <code className="mono overflow-x-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface-alt)] px-3.5 py-2.5 text-[13px] whitespace-nowrap select-all">
                {referralLink}
              </code>
              <ShareActions
                link={referralLink}
                message="J’utilise AdminPilot pour suivre mes abonnements et mes factures. Avec mon lien, tu as 1 mois de Pro offert :"
              />
              <p className="m-0 text-xs text-[var(--text-faint)]">
                Ton lien reste disponible dans Réglages → Parrainage.
              </p>
            </div>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-[var(--border-soft)] px-5 py-3.5">
          {step > 0 && (
            <button
              type="button"
              onClick={() => go(step - 1)}
              className="flex items-center gap-1.5 text-[13px] text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              <ArrowLeft className="size-4" />
              Retour
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {step === 3 && (
              <button
                type="button"
                onClick={() => go(step + 1)}
                className="h-10 px-3 text-[13px] text-[var(--text-dim)] hover:text-[var(--text)]"
              >
                Plus tard
              </button>
            )}
            {last ? (
              <button
                type="button"
                onClick={finish}
                disabled={saving}
                className="btn-primary h-10 px-4 text-[13px] disabled:opacity-60"
              >
                {saving ? "Un instant…" : "Terminer"}
                <Check className="size-4" />
              </button>
            ) : step === 3 ? (
              <button
                type="button"
                onClick={confirmForwarding}
                disabled={saving}
                className="btn-primary h-10 px-4 text-[13px] disabled:opacity-60"
              >
                {saving ? "Un instant…" : "C’est fait"}
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => go(step + 1)}
                className="btn-primary h-10 px-4 text-[13px]"
              >
                {step === 0 ? "C’est parti" : "Continuer"}
                <ArrowRight className="size-4" />
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function StepTitle({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 id="tour-title" className="m-0 text-[20px] font-semibold tracking-[-0.01em]">
        {title}
      </h2>
      <p className="m-0 mt-1.5 text-sm leading-[1.6] text-[var(--text-dim)]">{children}</p>
    </div>
  );
}

function Benefit({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[rgb(var(--accent-rgb)/.14)] text-[var(--accent-light)]">
        {icon}
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="text-[13px] text-[var(--text-dim)]">{children}</span>
      </span>
    </li>
  );
}

function Numbered({
  n,
  title,
  last,
  children,
}: {
  n: number;
  title: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[30px_1fr] gap-x-3.5">
      <div className="flex flex-col items-center">
        <span className="mono grid size-7 shrink-0 place-items-center rounded-full border border-[var(--border-strong)] text-[11px] text-[var(--text-muted)]">
          {n}
        </span>
        {!last && <span aria-hidden className="w-px flex-1 bg-[var(--border)]" />}
      </div>
      <div className={last ? "" : "pb-6"}>
        <h3 className="m-0 mt-1 mb-2.5 text-[15px] font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}
