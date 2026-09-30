-- Fond de l'interface, second volet du thème avec `accent` (migration 0011).
-- Liste fermée, alignée sur BACKGROUNDS (constants.ts) et sur les thèmes
-- `[data-bg]` de globals.css. Écrit uniquement par PATCH /api/profile.
alter table profiles
  add column background text not null default 'nuit'
    check (background in ('nuit', 'charbon', 'ardoise', 'foret', 'prune'));
