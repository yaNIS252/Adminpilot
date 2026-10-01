-- Surveillance des prix : historique des changements de tarif par abonnement.
--
-- Deux sources : la comparaison d'une facture avec la précédente, et l'e-mail
-- d'annonce que beaucoup de fournisseurs doivent envoyer avant d'augmenter
-- (un mois avant pour les télécoms), qui permet de prévenir AVANT le premier
-- prélèvement plus cher.

create table price_changes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles on delete cascade,
  subscription_id uuid not null references subscriptions on delete cascade,
  old_amount      numeric(10, 2) not null,
  new_amount      numeric(10, 2) not null,
  currency        text not null default 'EUR',
  cycle           billing_cycle not null,
  kind            text not null check (kind in ('increase', 'decrease')),
  source          text not null check (source in ('invoice', 'announcement')),
  -- Date d'application annoncée ; null pour un changement constaté sur facture.
  effective_date  date,
  -- Empêche d'enregistrer deux fois le même changement (facture renvoyée,
  -- annonce puis première facture au nouveau prix).
  dedup_key       text not null unique,
  created_at      timestamptz not null default now()
);

create index price_changes_user_idx on price_changes (user_id, created_at desc);
create index price_changes_sub_idx  on price_changes (subscription_id, created_at desc);

alter table price_changes enable row level security;

create policy "price_changes: read own" on price_changes
  for select using (user_id = (select auth.uid()));
create policy "price_changes: delete own" on price_changes
  for delete using (user_id = (select auth.uid()));

revoke insert, update on price_changes from authenticated;
revoke insert, update, delete on price_changes from anon;

-- Nature de l'alerte : le cron choisit le gabarit d'e-mail d'après elle.
alter table alerts
  add column kind text not null default 'deadline'
    check (kind in ('deadline', 'price_change')),
  add column price_change_id uuid references price_changes on delete cascade;
