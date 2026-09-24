-- AdminPilot — schéma initial
-- RLS activée sur toutes les tables portant des données utilisateur.
-- Les écritures du pipeline d'ingestion passent par la service role key (serveur uniquement).

create extension if not exists "pgcrypto";
create extension if not exists "unaccent" with schema extensions;

-- ---------------------------------------------------------------- enums

create type plan            as enum ('free', 'pro', 'family');
create type billing_cycle   as enum ('monthly', 'yearly', 'quarterly', 'weekly', 'one_time', 'unknown');
create type sub_status      as enum ('active', 'cancelled', 'paused', 'expired', 'unknown');
create type doc_category    as enum ('facture', 'contrat', 'assurance', 'impots', 'banque',
                                     'logement', 'sante', 'vehicule', 'identite', 'travail', 'autre');
create type alert_channel   as enum ('email', 'push', 'both');
create type cancel_status   as enum ('draft', 'generated', 'sent', 'confirmed');
create type job_status      as enum ('pending', 'processing', 'done', 'failed', 'needs_review');
create type job_source      as enum ('email', 'upload');
create type cancel_method   as enum ('courrier', 'email', 'en_ligne');
create type legal_basis     as enum ('hamon', 'chatel', 'infra_annuelle', 'libre');

-- ---------------------------------------------------------------- profiles

create table profiles (
  id                      uuid primary key references auth.users on delete cascade,
  email                   text not null,
  name                    text,
  plan                    plan not null default 'free',
  stripe_customer_id      text unique,
  stripe_sub_id           text,
  -- jeton public de l'adresse d'ingestion : u-<token>@in.adminpilot.fr
  inbox_token             text not null unique default encode(gen_random_bytes(6), 'hex'),
  gmail_forward_verified  boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- RGPD : suppression douce, purge définitive par tâche planifiée
  deleted_at              timestamptz
);

-- Un profil est créé automatiquement à l'inscription.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------- known_providers

create table known_providers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  domain         text not null unique,
  sender_emails  text[] not null default '{}',
  category       text not null,
  cancel_method  cancel_method,
  cancel_address text,
  cancel_email   text,
  cancel_url     text,
  legal_basis    legal_basis not null default 'libre',
  -- alimente les pages SEO /resilier/[slug]
  seo_slug       text not null unique,
  created_at     timestamptz not null default now()
);

create index known_providers_category_idx on known_providers (category);

-- ---------------------------------------------------------------- ingestion_jobs

create table ingestion_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles on delete cascade,
  source       job_source not null,
  raw_url      text,
  mime_type    text,
  -- SHA-256 : Message-ID pour un mail, contenu du fichier pour un upload.
  -- La contrainte d'unicité EST le mécanisme d'idempotence du pipeline.
  content_hash text not null,
  status       job_status not null default 'pending',
  attempts     int not null default 0,
  error        text,
  model_used   text,
  tokens_in    int,
  tokens_out   int,
  created_at   timestamptz not null default now(),
  processed_at timestamptz,
  unique (user_id, content_hash)
);

-- Index partiel : le drain de file ne balaie que les jobs en attente.
create index ingestion_jobs_pending_idx
  on ingestion_jobs (created_at)
  where status in ('pending', 'failed');

create index ingestion_jobs_user_idx on ingestion_jobs (user_id, created_at desc);

-- ---------------------------------------------------------------- subscriptions

create table subscriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles on delete cascade,
  provider          text not null,
  provider_id       uuid references known_providers on delete set null,
  amount            numeric(10, 2),
  currency          text not null default 'EUR',
  cycle             billing_cycle not null default 'unknown',
  category          text,
  next_renewal      date,
  status            sub_status not null default 'active',
  confidence        real not null default 0,
  -- tant que faux, aucune action irréversible n'est permise sur cette ligne
  confirmed_by_user boolean not null default false,
  source_job_id     uuid references ingestion_jobs on delete set null,
  metadata          jsonb,
  detected_at       timestamptz not null default now(),
  cancelled_at      timestamptz
);

create index subscriptions_user_idx     on subscriptions (user_id, status);
create index subscriptions_renewal_idx  on subscriptions (next_renewal) where status = 'active';

-- ---------------------------------------------------------------- documents

create table documents (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles on delete cascade,
  file_url          text not null,
  file_size         int,
  mime_type         text,
  filename_original text not null,
  filename_ai       text,
  category          doc_category not null default 'autre',
  extracted_data    jsonb,
  deadline          date,
  confidence        real not null default 0,
  source_job_id     uuid references ingestion_jobs on delete set null,
  search_vector     tsvector,
  created_at        timestamptz not null default now()
);

create index documents_user_idx     on documents (user_id, created_at desc);
create index documents_category_idx on documents (user_id, category);
create index documents_search_idx   on documents using gin (search_vector);
create index documents_deadline_idx on documents (deadline) where deadline is not null;

-- Recherche full-text française. Suffisant au MVP ; pgvector seulement si ça plafonne.
create or replace function documents_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('french', extensions.unaccent(coalesce(new.filename_ai, new.filename_original))), 'A') ||
    setweight(to_tsvector('french', extensions.unaccent(coalesce(new.extracted_data::text, ''))), 'B');
  return new;
end;
$$;

create trigger documents_search_vector_trigger
  before insert or update of filename_ai, filename_original, extracted_data
  on documents
  for each row execute function documents_search_vector_update();

-- ---------------------------------------------------------------- alerts

create table alerts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles on delete cascade,
  ref_type   text not null check (ref_type in ('subscription', 'document')),
  ref_id     uuid not null,
  title      text not null,
  message    text not null,
  alert_date date not null,
  channel    alert_channel not null default 'email',
  sent_at    timestamptz,
  -- garantit qu'une même échéance ne déclenche jamais deux envois
  dedup_key  text not null unique,
  created_at timestamptz not null default now()
);

create index alerts_dispatch_idx on alerts (alert_date) where sent_at is null;
create index alerts_user_idx     on alerts (user_id, alert_date desc);

-- ---------------------------------------------------------------- cancellations

create table cancellations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles on delete cascade,
  subscription_id uuid not null unique references subscriptions on delete cascade,
  template_used   legal_basis,
  letter_content  text,
  letter_url      text,
  status          cancel_status not null default 'draft',
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index cancellations_user_idx on cancellations (user_id, created_at desc);

-- ---------------------------------------------------------------- family_members

create table family_members (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references profiles on delete cascade,
  email      text not null,
  name       text,
  invited_at timestamptz not null default now(),
  joined_at  timestamptz,
  unique (owner_id, email)
);

-- ---------------------------------------------------------------- usage_counters

create table usage_counters (
  user_id             uuid not null references profiles on delete cascade,
  period              text not null,               -- 'YYYY-MM'
  subscriptions_count int not null default 0,
  docs_count          int not null default 0,
  alerts_count        int not null default 0,
  searches_count      int not null default 0,
  cancellations_count int not null default 0,
  primary key (user_id, period)
);

-- ---------------------------------------------------------------- RLS

alter table profiles        enable row level security;
alter table ingestion_jobs  enable row level security;
alter table subscriptions   enable row level security;
alter table documents       enable row level security;
alter table alerts          enable row level security;
alter table cancellations   enable row level security;
alter table family_members  enable row level security;
alter table usage_counters  enable row level security;
alter table known_providers enable row level security;

-- Propriété stricte : un utilisateur ne voit que ses propres lignes.
create policy "profiles: self" on profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "jobs: own"          on ingestion_jobs
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "subscriptions: own" on subscriptions
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "documents: own"     on documents
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "alerts: own"        on alerts
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "cancellations: own" on cancellations
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "family: owner"      on family_members
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Compteurs de quota : lecture seule côté client, écriture réservée au serveur.
create policy "usage: read own"    on usage_counters
  for select using (user_id = (select auth.uid()));

-- Catalogue public : lisible par tous, alimente aussi les pages SEO.
create policy "providers: public read" on known_providers
  for select using (true);
