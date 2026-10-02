-- Comparateur d'offres.
--
-- Catalogue saisi à la main (ou fourni par des partenaires), jamais généré :
-- un prix inventé dans un comparateur est une pratique commerciale trompeuse.
-- `checked_at` date la dernière vérification ; une offre périmée
-- (`valid_until` dépassé) ou inactive n'est pas affichée.

create table offers (
  id             uuid primary key default gen_random_uuid(),
  category       text not null,
  provider_name  text not null,
  name           text not null,
  monthly_price  numeric(10, 2) not null check (monthly_price >= 0),
  conditions     text,
  url            text not null check (url like 'https://%'),
  -- Lien de suivi d'un partenaire d'affiliation : s'il est utilisé,
  -- l'interface l'indique (« lien partenaire »).
  affiliate_url  text check (affiliate_url is null or affiliate_url like 'https://%'),
  valid_until    date,
  checked_at     date not null default current_date,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create index offers_category_idx on offers (category, monthly_price) where active;

alter table offers enable row level security;
create policy "offers: public read" on offers for select using (active);
revoke insert, update, delete on offers from anon, authenticated;

-- Clics sortants : servent à rapprocher les commissions des partenaires.
create table offer_clicks (
  id         uuid primary key default gen_random_uuid(),
  offer_id   uuid not null references offers on delete cascade,
  user_id    uuid references profiles on delete set null,
  created_at timestamptz not null default now()
);

create index offer_clicks_offer_idx on offer_clicks (offer_id, created_at desc);

alter table offer_clicks enable row level security;
-- Aucune policy : écrit et lu uniquement par le serveur.
revoke all on offer_clicks from anon, authenticated;
