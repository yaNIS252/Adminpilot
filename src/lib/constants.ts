import type { Enums } from "@/lib/supabase/types";

/**
 * Limites par plan. Source de vérité unique : l'UI (plan-gate) et le serveur
 * (quotas) lisent la même table, donc un affichage ne peut pas diverger d'une
 * vérification réelle.
 *
 * `null` = illimité.
 */
export type Feature =
  | "subscriptions"
  | "documents"
  | "alerts"
  | "searches"
  | "cancellations";

export const PLAN_LIMITS: Record<
  Enums<"plan">,
  Record<Feature, number | null>
> = {
  free: {
    subscriptions: 5,
    documents: 10,
    alerts: 1,
    searches: 5,
    cancellations: 0,
  },
  pro: {
    subscriptions: null,
    documents: 500,
    alerts: null,
    searches: null,
    cancellations: 3,
  },
  family: {
    subscriptions: null,
    documents: 1000,
    alerts: null,
    searches: null,
    cancellations: null,
  },
};

export const PLAN_PRICES = {
  pro: { monthly: 5.99, yearly: 49 },
  family: { monthly: 9.99, yearly: 89 },
} as const;

/** Nombre de membres du foyer, plan Famille. */
export const FAMILY_SEATS = 5;

// ---------------------------------------------------------------- ingestion

/** Types de fichiers acceptés à l'upload. Claude les lit tous nativement. */
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 Mo

/**
 * Rétention du document brut sur R2 après extraction.
 *
 * Obligation RGPD de minimisation : une fois les données structurées extraites,
 * l'email d'origine n'a plus d'utilité. On garde une fenêtre courte pour
 * pouvoir rejouer une extraction ratée, puis on purge.
 */
export const RAW_RETENTION_DAYS = 30;

// ---------------------------------------------------------------- alertes

/** Jours avant échéance déclenchant une alerte automatique. */
export const ALERT_OFFSETS_DAYS = [7, 1] as const;

// ---------------------------------------------------------------- résiliation

export const LEGAL_BASIS_LABELS: Record<Enums<"legal_basis">, string> = {
  hamon: "Loi Hamon — résiliation à tout moment après un an",
  chatel: "Loi Chatel — reconduction tacite et préavis",
  infra_annuelle: "Résiliation infra-annuelle — santé et mutuelle",
  libre: "Contrat sans engagement",
};
