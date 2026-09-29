-- Profil personnalisable et foyer Premium.

-- ---------------------------------------------------------------- profil
-- Couleur d'accent de l'interface. Liste fermée : une valeur libre finirait
-- injectée dans un attribut, et rien ne justifie de l'accepter.
alter table profiles
  add column accent text not null default 'violet'
    check (accent in ('violet', 'bleu', 'sarcelle', 'ambre', 'rose')),
  -- Chemin dans le bucket privé `avatars`, écrit uniquement par le serveur
  -- après contrôle du type réel du fichier.
  add column avatar_path text;

-- ---------------------------------------------------------------- foyer
-- La table existait depuis le schéma initial sans être utilisée. Un membre
-- invité garde son propre compte, sa propre adresse d'ingestion et ses propres
-- données : le foyer partage la formule, pas les documents.
alter table family_members
  add column member_id    uuid unique references profiles on delete cascade,
  -- Empreinte SHA-256 du jeton d'invitation, jamais le jeton lui-même : une
  -- fuite de la table ne permettrait pas de rejoindre un foyer.
  add column token_hash   text unique,
  add column expires_at   timestamptz;

create index family_members_owner_idx on family_members (owner_id);

-- Le membre voit la ligne qui le rattache au foyer (pour afficher « inclus
-- dans le foyer de … » et pouvoir le quitter). La policy existante couvre le
-- titulaire. Aucune écriture côté client : tout passe par les routes serveur.
create policy "family: member reads own link" on family_members
  for select using (member_id = (select auth.uid()));

-- ---------------------------------------------------------------- avatars
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
