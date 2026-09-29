"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Check, Lock } from "lucide-react";
import { useRef, useState } from "react";

import { Avatar } from "@/components/shared/avatar";
import { ACCENTS, type AccentId } from "@/lib/constants";

/**
 * Personnalisation du compte : prénom, photo et couleur de l'interface.
 *
 * La couleur s'applique à l'écran avant même la réponse du serveur — un
 * sélecteur de thème qui attend un aller-retour paraît cassé. En cas d'échec,
 * on revient à l'ancienne.
 */
export function ProfileEditor({
  email,
  initialName,
  avatarUrl,
  accent,
  paid,
}: {
  email: string;
  initialName: string | null;
  avatarUrl: string | null;
  accent: AccentId;
  paid: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName ?? "");
  const [current, setCurrent] = useState<AccentId>(accent);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const nameChanged = name.trim() !== (initialName ?? "");

  function paint(value: AccentId) {
    document
      .querySelectorAll<HTMLElement>("[data-accent]")
      .forEach((element) => element.setAttribute("data-accent", value));
  }

  async function patch(body: Record<string, string>) {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  }

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const ok = await patch({ name: name.trim() }).catch(() => false);
    setMessage(
      ok
        ? { tone: "ok", text: "Prénom enregistré." }
        : { tone: "error", text: "Le prénom n’a pas pu être enregistré." },
    );
    setSaving(false);
    if (ok) router.refresh();
  }

  async function pickAccent(value: AccentId) {
    if (value === current) return;
    const previous = current;
    setCurrent(value);
    paint(value);
    const ok = await patch({ accent: value }).catch(() => false);
    if (!ok) {
      setCurrent(previous);
      paint(previous);
      setMessage({ tone: "error", text: "La couleur n’a pas pu être enregistrée." });
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setMessage(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/profile/avatar", { method: "POST", body: form });
      if (response.ok) {
        router.refresh();
      } else {
        setMessage({
          tone: "error",
          text:
            response.status === 413
              ? "Image trop lourde : 2 Mo maximum."
              : response.status === 415
                ? "Format non accepté : JPEG, PNG ou WebP."
                : response.status === 429
                  ? "Trop de changements d’un coup, réessaie plus tard."
                  : "La photo n’a pas pu être enregistrée.",
        });
      }
    } catch {
      setMessage({ tone: "error", text: "Connexion interrompue. Réessaie." });
    }
    setUploading(false);
  }

  async function removeAvatar() {
    const response = await fetch("/api/profile/avatar", { method: "DELETE" });
    if (response.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="group relative rounded-full"
          aria-label="Changer la photo de profil"
        >
          <Avatar name={name || email} url={avatarUrl} size={64} />
          <span className="absolute inset-0 grid place-items-center rounded-full bg-[rgba(0,0,0,.55)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Camera className="size-5 text-white" />
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="btn-link self-start p-0 text-sm"
          >
            {uploading ? "Envoi…" : avatarUrl ? "Changer la photo" : "Ajouter une photo"}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={removeAvatar}
              className="self-start text-xs text-[var(--text-faint)] hover:text-[var(--danger-light)]"
            >
              Retirer
            </button>
          )}
          <span className="text-xs text-[var(--text-faint)]">JPEG, PNG ou WebP, 2 Mo max.</span>
        </div>
      </div>

      <form onSubmit={saveName} className="flex flex-col gap-2">
        <label htmlFor="profile-name" className="text-[13px] font-medium">
          Prénom affiché
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            placeholder="Ton prénom"
            className="h-10 min-w-[200px] flex-1 rounded-[8px] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={saving || !nameChanged}
            className="btn-secondary h-10 px-4 text-sm disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-2.5">
        <div className="text-[13px] font-medium">Couleur de l’interface</div>
        <div role="radiogroup" aria-label="Couleur de l’interface" className="flex flex-wrap gap-2.5">
          {ACCENTS.map((item) => {
            const locked = !item.free && !paid;
            const selected = current === item.id;
            const swatch = (
              <span
                className={`relative grid size-9 place-items-center rounded-full border-2 transition-transform ${
                  selected ? "border-white" : "border-transparent group-hover:scale-105"
                }`}
                style={{ background: item.hex }}
              >
                {selected && <Check className="size-4 text-[#16141f]" />}
                {locked && (
                  <span className="absolute -right-1 -bottom-1 grid size-[18px] place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)]">
                    <Lock className="size-2.5 text-[var(--text-dim)]" />
                  </span>
                )}
              </span>
            );

            return locked ? (
              <Link
                key={item.id}
                href="/reglages?formule=pro#formules"
                title={`${item.label} — avec Pro`}
                aria-label={`${item.label}, réservé aux formules Pro et Premium`}
                className="group opacity-80"
              >
                {swatch}
              </Link>
            ) : (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={item.label}
                title={item.label}
                onClick={() => pickAccent(item.id)}
                className="group"
              >
                {swatch}
              </button>
            );
          })}
        </div>
        {!paid && (
          <p className="m-0 text-xs text-[var(--text-faint)]">
            <Lock className="mr-1 inline size-3" />
            Sarcelle, ambre et rose sont inclus dans Pro et Premium.
          </p>
        )}
      </div>

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`m-0 text-[13px] ${
            message.tone === "ok" ? "text-[var(--positive-light)]" : "text-[var(--danger-light)]"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
