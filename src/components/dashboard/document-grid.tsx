"use client";

import { useRouter } from "next/navigation";
import { ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { UpgradeNotice } from "@/components/billing/upgrade-notice";
import { DOC_CATEGORIES } from "@/lib/ai/schemas";
import { ACCEPTED_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { formatDate, formatRelativeDeadline } from "@/lib/format";
import type { DocumentRow } from "@/lib/supabase/types";

const CATEGORY_LABELS: Record<string, string> = {
  facture: "Facture",
  contrat: "Contrat",
  assurance: "Assurance",
  impots: "Impôts",
  banque: "Banque",
  logement: "Logement",
  sante: "Santé",
  vehicule: "Véhicule",
  identite: "Identité",
  travail: "Travail",
  autre: "Autre",
};

/**
 * Coffre-fort documentaire : dépôt, filtrage, consultation.
 *
 * L'ouverture d'un document passe par `/api/docs/[id]`, qui émet une URL signée
 * valable une heure. Le bucket n'est jamais public.
 */
export function DocumentGrid({ initial }: { initial: DocumentRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  // Liste renvoyée par le serveur après un rafraîchissement (document
  // analysé) : reprise telle quelle, sans perdre le message affiché.
  const [previousInitial, setPreviousInitial] = useState(initial);
  if (initial !== previousInitial) {
    setPreviousInitial(initial);
    setItems(initial);
  }
  const [category, setCategory] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  // Limite de documents atteinte : un encart pour passer Pro plutôt que le
  // « quota atteint » brut renvoyé par le serveur.
  const [quotaReached, setQuotaReached] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const visible = category
    ? items.filter((doc) => doc.category === category)
    : items;

  // Seules les catégories réellement présentes sont proposées : un filtre qui
  // ne renvoie jamais rien est une fausse piste.
  const presentCategories = DOC_CATEGORIES.filter((value) =>
    items.some((doc) => doc.category === value),
  );

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    let accepted = 0;

    for (const file of Array.from(files)) {
      if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
        setStatus(`${file.name} : format non accepté.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setStatus(`${file.name} : dépasse 10 Mo.`);
        continue;
      }

      setStatus(`Envoi de ${file.name}…`);
      const form = new FormData();
      form.append("file", file);

      const response = await fetch("/api/docs/upload", {
        method: "POST",
        body: form,
      });
      const body = await response.json().catch(() => ({}));

      if (response.status === 402) {
        setQuotaReached(typeof body.max === "number" ? body.max : 0);
        setStatus(`${file.name} n’a pas été ajouté : ton coffre-fort est plein.`);
        // Les fichiers suivants seraient refusés pour la même raison.
        break;
      }

      if (!response.ok) {
        setStatus(
          response.status === 415
            ? `${file.name} : ce type de fichier n’est pas accepté.`
            : response.status === 429
              ? "Trop d’envois en peu de temps. Réessaie dans quelques minutes."
              : `${file.name} : l’envoi a échoué. Réessaie dans un instant.`,
        );
        continue;
      }

      // L'analyse est asynchrone : le document existe, mais son classement
      // arrivera dans quelques secondes. Le dire évite que l'utilisateur
      // recharge en pensant que rien ne s'est passé.
      if (body.status !== "duplicate") accepted += 1;
      setStatus(
        body.status === "duplicate"
          ? `${file.name} était déjà dans ton coffre-fort.`
          : `${file.name} reçu — analyse en cours, il apparaîtra dans un instant.`,
      );
    }

    // L'analyse prend quelques secondes : la liste et le compteur de la
    // barre latérale se mettent à jour d'eux-mêmes, sans recharger.
    if (accepted > 0) {
      for (const delay of [4_000, 10_000, 20_000]) {
        setTimeout(() => router.refresh(), delay);
      }
    }
  }

  async function open(id: string) {
    const response = await fetch(`/api/docs/${id}`);
    if (!response.ok) {
      setStatus("Impossible d’ouvrir ce document.");
      return;
    }
    const { url } = await response.json();
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function remove(id: string) {
    const response = await fetch(`/api/docs/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setStatus("La suppression n’a pas abouti.");
      return;
    }
    setItems((current) => current.filter((doc) => doc.id !== id));
    // Compteur de la barre latérale.
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files);
        }}
        className={`anim-up rounded-[var(--radius-xl)] border border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-[var(--accent)] bg-[rgb(var(--accent-rgb)/.08)]"
            : "border-[var(--border-strong)] bg-[rgba(255,255,255,.02)]"
        }`}
      >
        <span className="mx-auto mb-3 grid size-11 place-items-center rounded-[var(--radius)] bg-[rgb(var(--accent-rgb)/.14)] text-[var(--accent-light)]">
          <Upload className="size-5" />
        </span>
        <p className="m-0 mb-3 text-sm text-[var(--text-dim)]">
          Dépose un PDF ou une photo, ou
        </p>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="btn-primary h-10 px-4 text-sm"
        >
          Choisir un fichier
        </button>
        <p className="m-0 mt-3 text-xs text-[var(--text-faint)]">
          PDF, JPEG, PNG ou WebP · 10 Mo maximum
        </p>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPTED_MIME_TYPES.join(",")}
          onChange={(event) => void upload(event.target.files)}
          className="hidden"
        />
      </div>

      {quotaReached !== null && (
        <UpgradeNotice
          title="Coffre-fort plein"
          body={`La formule gratuite garde ${quotaReached || "tes"} documents. Passe Pro pour en ajouter autant que tu veux, et les retrouver en langage courant.`}
        />
      )}

      {status && (
        <p
          role="status"
          className="m-0 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-4 py-2.5 text-sm text-[var(--text-dim)]"
        >
          {status}
        </p>
      )}

      {presentCategories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Pill active={category === ""} onClick={() => setCategory("")}>
            Tout · {items.length}
          </Pill>
          {presentCategories.map((value) => (
            <Pill
              key={value}
              active={category === value}
              onClick={() => setCategory(value)}
            >
              {CATEGORY_LABELS[value] ?? value} ·{" "}
              {items.filter((doc) => doc.category === value).length}
            </Pill>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="card-sheen rounded-[var(--radius-xl)] border border-[var(--border)] px-4 py-12 text-center text-sm text-[var(--text-faint)]">
          Aucun document ici.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {visible.map((doc) => (
            <li
              key={doc.id}
              className="card-sheen flex flex-wrap items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--border)] p-4 transition-colors hover:border-[rgb(var(--accent-rgb)/.28)]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[rgba(111,124,245,.14)] text-[#aab3ff]">
                <FileText className="size-[18px]" />
              </span>

              <div className="min-w-[8rem] flex-1">
                <div className="truncate text-sm font-medium">
                  {doc.filename_ai ?? doc.filename_original}
                </div>
                <div className="text-xs text-[var(--text-faint)]">
                  {[
                    CATEGORY_LABELS[doc.category] ?? doc.category,
                    formatDate(doc.created_at),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>

              {doc.deadline && (
                <span className="shrink-0 rounded-full bg-[rgba(224,161,56,.14)] px-2.5 py-1 text-[11px] text-[var(--warning-light)]">
                  échéance {formatRelativeDeadline(doc.deadline)}
                </span>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => open(doc.id)}
                  className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[rgba(255,255,255,.06)] hover:text-white"
                >
                  <ExternalLink className="size-4" />
                  Ouvrir
                </button>
                <button
                  type="button"
                  onClick={() => remove(doc.id)}
                  aria-label="Supprimer"
                  title="Supprimer"
                  className="grid size-[34px] place-items-center rounded-[var(--radius-sm)] border border-[rgba(240,113,104,.3)] text-[var(--danger-light)] transition-colors hover:bg-[rgba(240,113,104,.12)]"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-[rgb(var(--accent-rgb)/.45)] bg-[rgb(var(--accent-rgb)/.16)] text-[var(--accent-lighter)]"
          : "border-[var(--border)] text-[var(--text-dim)] hover:bg-[rgba(255,255,255,.05)]"
      }`}
    >
      {children}
    </button>
  );
}
