-- Liens de résiliation : vérifiés à la main, puis enrichis par les utilisateurs.
--
-- `verified_at` date la vérification d'un lien du catalogue. Seuls les liens
-- dont la page officielle a été lue sont ajoutés ; dans le doute, le champ
-- reste vide plutôt qu'inventé.

alter table known_providers add column verified_at timestamptz;

update known_providers set cancel_url = 'https://www.youtube.com/paid_memberships', verified_at = now() where name = 'YouTube Premium';
update known_providers set cancel_url = 'https://www.deezer.com/account/subscription', verified_at = now() where name = 'Deezer';
update known_providers set cancel_url = 'https://support.apple.com/fr-fr/118428', verified_at = now() where name in ('Apple TV+', 'iCloud');
update known_providers set cancel_url = 'https://account.microsoft.com/services', verified_at = now() where name = 'Microsoft 365';
update known_providers set cancel_url = 'https://www.bouyguestelecom.fr/mon-compte/demande-resiliation?contexte=LEGAL', verified_at = now() where name = 'Bouygues Telecom';
update known_providers set cancel_url = 'https://www.red-by-sfr.fr/mon-espace-client/', verified_at = now() where name = 'RED by SFR';
update known_providers set cancel_url = 'https://support.n26.com/fr-fr/adhesions-et-formules-de-compte/comptes-premium/comment-annuler-mon-adhesion-n26-premium', verified_at = now() where name = 'N26';

-- Propositions des utilisateurs, avec le verdict de l'IA. Écrites par le
-- serveur seul ; chacun ne lit que les siennes. Un lien entre au catalogue
-- quand trois comptes différents l'ont proposé avec un verdict favorable, ou
-- quand l'administrateur passe `status` à 'approved' (requête SQL).
create table cancel_link_suggestions (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid references known_providers on delete cascade,
  subscription_id uuid references subscriptions on delete set null,
  user_id       uuid not null references profiles on delete cascade,
  url           text not null check (url like 'https://%' and char_length(url) <= 2000),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  ai_verdict    jsonb,
  created_at    timestamptz not null default now()
);
create index cancel_link_suggestions_provider_idx on cancel_link_suggestions (provider_id, url);
create index cancel_link_suggestions_user_day_idx on cancel_link_suggestions (user_id, created_at desc);
alter table cancel_link_suggestions enable row level security;
create policy "cancel_link_suggestions: own read" on cancel_link_suggestions for select using (user_id = (select auth.uid()));
revoke insert, update, delete on cancel_link_suggestions from anon, authenticated;
