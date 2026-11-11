-- Essai Pro, boîtes mail multiples, notifications, doublons du foyer.

alter table profiles
  -- Essai Pro de 14 jours à l'inscription : une seule fois par compte.
  add column trial_started_at timestamptz,
  -- Accord pour participer à la détection des doublons du foyer (Premium).
  -- Faux par défaut : les abonnements d'un membre restent privés.
  add column household_share boolean not null default false,
  -- Dernière fois qu'une boîte mail en trop a tenté de se brancher.
  add column mailbox_limit_at timestamptz;

-- Boîtes mail qui transfèrent vers le compte (1 en gratuit et Pro, 3 en
-- Premium). Connues par la demande de validation de Gmail, qui les nomme.
create table mailboxes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles on delete cascade,
  address    text not null check (char_length(address) <= 254),
  created_at timestamptz not null default now(),
  unique (user_id, address)
);
alter table mailboxes enable row level security;
create policy "mailboxes: own read" on mailboxes for select using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate, references, trigger on mailboxes from anon, authenticated;

-- Abonnements aux notifications du navigateur (Premium). Serveur seul.
create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles on delete cascade,
  endpoint   text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 2000),
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on push_subscriptions (user_id);
alter table push_subscriptions enable row level security;
revoke all on push_subscriptions from anon, authenticated;

-- Les abonnements masqués (au-delà de la limite gratuite) ne sont plus
-- lisibles par l'API de la base : seul le serveur les compte.
create policy "subscriptions: masqués invisibles" on subscriptions
  as restrictive for select to authenticated using (not over_quota);
