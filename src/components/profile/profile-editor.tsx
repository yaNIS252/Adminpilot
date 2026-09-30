"use client";

import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { useRef, useState } from "react";

import { Avatar } from "@/components/shared/avatar";

/**
 * Personnalisation du compte : prénom et photo. Le thème a sa propre carte
 * (`ThemePicker`).
 */
export function ProfileEditor({
  email,
  initialName,
  avatarUrl,
}: {
  email: string;
  initialName: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const nameChanged = name.trim() !== (initialName ?? "");

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
