-- Thème clair : nouvelle valeur autorisée pour le fond de l'espace client.
alter table public.profiles drop constraint if exists profiles_background_check;
alter table public.profiles
  add constraint profiles_background_check
    check (background in ('nuit', 'charbon', 'clair', 'ardoise', 'foret', 'prune'));
