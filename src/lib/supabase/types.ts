/**
 * Types générés depuis le schéma Postgres. NE PAS ÉDITER À LA MAIN.
 * Régénérer après chaque migration : `npm run db:types`
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      alerts: {
        Row: {
          alert_date: string;
          channel: Database["public"]["Enums"]["alert_channel"];
          created_at: string;
          dedup_key: string;
          id: string;
          kind: string;
          price_change_id: string | null;
          message: string;
          ref_id: string;
          ref_type: string;
          sent_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          alert_date: string;
          channel?: Database["public"]["Enums"]["alert_channel"];
          created_at?: string;
          dedup_key: string;
          id?: string;
          kind?: string;
          price_change_id?: string | null;
          message: string;
          ref_id: string;
          ref_type: string;
          sent_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          alert_date?: string;
          channel?: Database["public"]["Enums"]["alert_channel"];
          created_at?: string;
          dedup_key?: string;
          id?: string;
          kind?: string;
          price_change_id?: string | null;
          message?: string;
          ref_id?: string;
          ref_type?: string;
          sent_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alerts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cancellations: {
        Row: {
          created_at: string;
          id: string;
          letter_content: string | null;
          letter_url: string | null;
          sent_at: string | null;
          status: Database["public"]["Enums"]["cancel_status"];
          subscription_id: string;
          template_used: Database["public"]["Enums"]["legal_basis"] | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          letter_content?: string | null;
          letter_url?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["cancel_status"];
          subscription_id: string;
          template_used?: Database["public"]["Enums"]["legal_basis"] | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          letter_content?: string | null;
          letter_url?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["cancel_status"];
          subscription_id?: string;
          template_used?: Database["public"]["Enums"]["legal_basis"] | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cancellations_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: true;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cancellations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          category: Database["public"]["Enums"]["doc_category"];
          confidence: number;
          created_at: string;
          deadline: string | null;
          extracted_data: Json | null;
          file_size: number | null;
          file_url: string;
          filename_ai: string | null;
          filename_original: string;
          id: string;
          mime_type: string | null;
          search_vector: unknown;
          source_job_id: string | null;
          user_id: string;
        };
        Insert: {
          category?: Database["public"]["Enums"]["doc_category"];
          confidence?: number;
          created_at?: string;
          deadline?: string | null;
          extracted_data?: Json | null;
          file_size?: number | null;
          file_url: string;
          filename_ai?: string | null;
          filename_original: string;
          id?: string;
          mime_type?: string | null;
          search_vector?: unknown;
          source_job_id?: string | null;
          user_id: string;
        };
        Update: {
          category?: Database["public"]["Enums"]["doc_category"];
          confidence?: number;
          created_at?: string;
          deadline?: string | null;
          extracted_data?: Json | null;
          file_size?: number | null;
          file_url?: string;
          filename_ai?: string | null;
          filename_original?: string;
          id?: string;
          mime_type?: string | null;
          search_vector?: unknown;
          source_job_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_source_job_id_fkey";
            columns: ["source_job_id"];
            isOneToOne: false;
            referencedRelation: "ingestion_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      family_members: {
        Row: {
          email: string;
          expires_at: string | null;
          id: string;
          invited_at: string;
          joined_at: string | null;
          member_id: string | null;
          name: string | null;
          owner_id: string;
          token_hash: string | null;
        };
        Insert: {
          email: string;
          expires_at?: string | null;
          id?: string;
          invited_at?: string;
          joined_at?: string | null;
          member_id?: string | null;
          name?: string | null;
          owner_id: string;
          token_hash?: string | null;
        };
        Update: {
          email?: string;
          expires_at?: string | null;
          id?: string;
          invited_at?: string;
          joined_at?: string | null;
          member_id?: string | null;
          name?: string | null;
          owner_id?: string;
          token_hash?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "family_members_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_members_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ingestion_jobs: {
        Row: {
          attempts: number;
          claimed_at: string | null;
          content_hash: string;
          created_at: string;
          error: string | null;
          id: string;
          mime_type: string | null;
          model_used: string | null;
          original_filename: string | null;
          processed_at: string | null;
          raw_url: string | null;
          source: Database["public"]["Enums"]["job_source"];
          status: Database["public"]["Enums"]["job_status"];
          tokens_in: number | null;
          tokens_out: number | null;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          claimed_at?: string | null;
          content_hash: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          mime_type?: string | null;
          model_used?: string | null;
          original_filename?: string | null;
          processed_at?: string | null;
          raw_url?: string | null;
          source: Database["public"]["Enums"]["job_source"];
          status?: Database["public"]["Enums"]["job_status"];
          tokens_in?: number | null;
          tokens_out?: number | null;
          user_id: string;
        };
        Update: {
          attempts?: number;
          claimed_at?: string | null;
          content_hash?: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          mime_type?: string | null;
          model_used?: string | null;
          original_filename?: string | null;
          processed_at?: string | null;
          raw_url?: string | null;
          source?: Database["public"]["Enums"]["job_source"];
          status?: Database["public"]["Enums"]["job_status"];
          tokens_in?: number | null;
          tokens_out?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      known_providers: {
        Row: {
          cancel_address: string | null;
          cancel_email: string | null;
          cancel_guide: Json | null;
          cancel_method: Database["public"]["Enums"]["cancel_method"] | null;
          cancel_url: string | null;
          category: string;
          created_at: string;
          domain: string;
          id: string;
          legal_basis: Database["public"]["Enums"]["legal_basis"];
          name: string;
          sender_emails: string[];
          seo_slug: string;
        };
        Insert: {
          cancel_address?: string | null;
          cancel_email?: string | null;
          cancel_guide?: Json | null;
          cancel_method?: Database["public"]["Enums"]["cancel_method"] | null;
          cancel_url?: string | null;
          category: string;
          created_at?: string;
          domain: string;
          id?: string;
          legal_basis?: Database["public"]["Enums"]["legal_basis"];
          name: string;
          sender_emails?: string[];
          seo_slug: string;
        };
        Update: {
          cancel_address?: string | null;
          cancel_email?: string | null;
          cancel_guide?: Json | null;
          cancel_method?: Database["public"]["Enums"]["cancel_method"] | null;
          cancel_url?: string | null;
          category?: string;
          created_at?: string;
          domain?: string;
          id?: string;
          legal_basis?: Database["public"]["Enums"]["legal_basis"];
          name?: string;
          sender_emails?: string[];
          seo_slug?: string;
        };
        Relationships: [];
      };
      offer_clicks: {
        Row: {
          created_at: string;
          id: string;
          offer_id: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          offer_id: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          offer_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "offer_clicks_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: false;
            referencedRelation: "offers";
            referencedColumns: ["id"];
          },
        ];
      };
      offers: {
        Row: {
          active: boolean;
          affiliate_url: string | null;
          category: string;
          checked_at: string;
          conditions: string | null;
          created_at: string;
          id: string;
          monthly_price: number;
          name: string;
          provider_name: string;
          url: string;
          valid_until: string | null;
        };
        Insert: {
          active?: boolean;
          affiliate_url?: string | null;
          category: string;
          checked_at?: string;
          conditions?: string | null;
          created_at?: string;
          id?: string;
          monthly_price: number;
          name: string;
          provider_name: string;
          url: string;
          valid_until?: string | null;
        };
        Update: {
          active?: boolean;
          affiliate_url?: string | null;
          category?: string;
          checked_at?: string;
          conditions?: string | null;
          created_at?: string;
          id?: string;
          monthly_price?: number;
          name?: string;
          provider_name?: string;
          url?: string;
          valid_until?: string | null;
        };
        Relationships: [

        ];
      };
      price_changes: {
        Row: {
          created_at: string;
          currency: string;
          cycle: Database["public"]["Enums"]["billing_cycle"];
          dedup_key: string;
          effective_date: string | null;
          id: string;
          kind: string;
          new_amount: number;
          old_amount: number;
          source: string;
          subscription_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          cycle: Database["public"]["Enums"]["billing_cycle"];
          dedup_key: string;
          effective_date?: string | null;
          id?: string;
          kind: string;
          new_amount: number;
          old_amount: number;
          source: string;
          subscription_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          cycle?: Database["public"]["Enums"]["billing_cycle"];
          dedup_key?: string;
          effective_date?: string | null;
          id?: string;
          kind?: string;
          new_amount?: number;
          old_amount?: number;
          source?: string;
          subscription_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_changes_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_changes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          accent: string;
          avatar_path: string | null;
          background: string;
          created_at: string;
          deleted_at: string | null;
          email: string;
          gmail_confirmation: Json | null;
          gmail_confirmation_at: string | null;
          gmail_forward_verified: boolean;
          id: string;
          inbox_token: string;
          last_recap_period: string | null;
          monthly_recap: boolean;
          name: string | null;
          plan: Database["public"]["Enums"]["plan"];
          stripe_customer_id: string | null;
          stripe_sub_id: string | null;
          updated_at: string;
        };
        Insert: {
          accent?: string;
          avatar_path?: string | null;
          background?: string;
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          gmail_confirmation?: Json | null;
          gmail_confirmation_at?: string | null;
          gmail_forward_verified?: boolean;
          id: string;
          inbox_token?: string;
          last_recap_period?: string | null;
          monthly_recap?: boolean;
          name?: string | null;
          plan?: Database["public"]["Enums"]["plan"];
          stripe_customer_id?: string | null;
          stripe_sub_id?: string | null;
          updated_at?: string;
        };
        Update: {
          accent?: string;
          avatar_path?: string | null;
          background?: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          gmail_confirmation?: Json | null;
          gmail_confirmation_at?: string | null;
          gmail_forward_verified?: boolean;
          id?: string;
          inbox_token?: string;
          last_recap_period?: string | null;
          monthly_recap?: boolean;
          name?: string | null;
          plan?: Database["public"]["Enums"]["plan"];
          stripe_customer_id?: string | null;
          stripe_sub_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          amount: number | null;
          cancelled_at: string | null;
          category: string | null;
          confidence: number;
          confirmed_by_user: boolean;
          currency: string;
          cycle: Database["public"]["Enums"]["billing_cycle"];
          detected_at: string;
          id: string;
          metadata: Json | null;
          next_renewal: string | null;
          over_quota: boolean;
          provider: string;
          provider_id: string | null;
          reminders_muted: boolean;
          source_job_id: string | null;
          status: Database["public"]["Enums"]["sub_status"];
          user_id: string;
        };
        Insert: {
          amount?: number | null;
          cancelled_at?: string | null;
          category?: string | null;
          confidence?: number;
          confirmed_by_user?: boolean;
          currency?: string;
          cycle?: Database["public"]["Enums"]["billing_cycle"];
          detected_at?: string;
          id?: string;
          metadata?: Json | null;
          next_renewal?: string | null;
          over_quota?: boolean;
          provider: string;
          provider_id?: string | null;
          reminders_muted?: boolean;
          source_job_id?: string | null;
          status?: Database["public"]["Enums"]["sub_status"];
          user_id: string;
        };
        Update: {
          amount?: number | null;
          cancelled_at?: string | null;
          category?: string | null;
          confidence?: number;
          confirmed_by_user?: boolean;
          currency?: string;
          cycle?: Database["public"]["Enums"]["billing_cycle"];
          detected_at?: string;
          id?: string;
          metadata?: Json | null;
          next_renewal?: string | null;
          over_quota?: boolean;
          provider?: string;
          provider_id?: string | null;
          reminders_muted?: boolean;
          source_job_id?: string | null;
          status?: Database["public"]["Enums"]["sub_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "known_providers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_source_job_id_fkey";
            columns: ["source_job_id"];
            isOneToOne: false;
            referencedRelation: "ingestion_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_counters: {
        Row: {
          alerts_count: number;
          cancellations_count: number;
          docs_count: number;
          period: string;
          searches_count: number;
          subscriptions_count: number;
          user_id: string;
        };
        Insert: {
          alerts_count?: number;
          cancellations_count?: number;
          docs_count?: number;
          period: string;
          searches_count?: number;
          subscriptions_count?: number;
          user_id: string;
        };
        Update: {
          alerts_count?: number;
          cancellations_count?: number;
          docs_count?: number;
          period?: string;
          searches_count?: number;
          subscriptions_count?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_counters_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_usage: {
        Args: { p_user_id: string; p_period: string; p_column: string };
        Returns: undefined;
      };
      consume_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_secs: number };
        Returns: boolean;
      };
      purge_rate_limits: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      claim_ingestion_jobs: {
        Args: {
          p_limit?: number;
          p_max_attempts?: number;
          p_stale_seconds?: number;
        };
        Returns: Database["public"]["Tables"]["ingestion_jobs"]["Row"][];
      };
    };
    Enums: {
      alert_channel: "email" | "push" | "both";
      billing_cycle:
        | "monthly"
        | "yearly"
        | "quarterly"
        | "weekly"
        | "one_time"
        | "unknown";
      cancel_method: "courrier" | "email" | "en_ligne";
      cancel_status: "draft" | "generated" | "sent" | "confirmed";
      doc_category:
        | "facture"
        | "contrat"
        | "assurance"
        | "impots"
        | "banque"
        | "logement"
        | "sante"
        | "vehicule"
        | "identite"
        | "travail"
        | "autre";
      job_source: "email" | "upload";
      job_status: "pending" | "processing" | "done" | "failed" | "needs_review";
      legal_basis: "hamon" | "chatel" | "infra_annuelle" | "libre";
      plan: "free" | "pro" | "family";
      sub_status: "active" | "cancelled" | "paused" | "expired" | "unknown";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]),
> = (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends {
  Row: infer R;
}
  ? R
  : never;

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never;

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never;

export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T];

// Alias courants, pour éviter `Tables<"subscriptions">` partout.
export type Profile = Tables<"profiles">;
export type Subscription = Tables<"subscriptions">;
export type DocumentRow = Tables<"documents">;
export type Alert = Tables<"alerts">;
export type Cancellation = Tables<"cancellations">;
export type IngestionJob = Tables<"ingestion_jobs">;
export type KnownProvider = Tables<"known_providers">;
export type UsageCounters = Tables<"usage_counters">;
