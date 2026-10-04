-- 1. Version du filtre Gmail importé
--
-- Gmail ne met jamais un filtre importé à jour. On garde l'empreinte de celui
-- que l'utilisateur a téléchargé : quand le catalogue ou les règles changent,
-- les réglages l'invitent à le réimporter.
alter table profiles add column gmail_filter_hash text;

-- 2. Apprentissage des adresses d'expédition
--
-- Quand une facture arrive d'une adresse que le catalogue ne connaît pas
-- (transfert manuel, option mots-clés), on la retient ici. Dès que plusieurs
-- comptes reçoivent leurs factures du même fournisseur connu depuis cette
-- adresse, elle rejoint le catalogue, donc le filtre de tous.
--
-- Aucune donnée personnelle de l'utilisateur : seule l'adresse d'envoi d'une
-- entreprise est gardée (jamais une messagerie grand public), et les comptes
-- ne sont comptés que par une empreinte salée, pour ne pas compter deux fois
-- le même.
create table sender_candidates (
  id            uuid primary key default gen_random_uuid(),
  sender_email  text not null unique,
  domain        text not null,
  provider      text not null,
  category      text,
  user_hashes   text[] not null default '{}',
  seen_count    int not null default 1,
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  provider_id   uuid references known_providers on delete set null,
  promoted_at   timestamptz
);

create index sender_candidates_pending_idx
  on sender_candidates (last_seen desc) where promoted_at is null;

-- Lu et écrit uniquement par le serveur.
alter table sender_candidates enable row level security;
revoke all on sender_candidates from anon, authenticated;
