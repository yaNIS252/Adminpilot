-- Index de recherche : découper les noms de fichiers en mots.
--
-- L'analyseur plein texte de Postgres reconnaît « Facture_EDF_2026-08.pdf »
-- comme un nom de fichier et en fait UN SEUL mot. Or c'est exactement la
-- forme des noms donnés par le renommage automatique : aucun document renommé
-- ne pouvait être retrouvé par « EDF », « facture » ou « loyer ». On remplace
-- les séparateurs par des espaces avant l'analyse, sur le nom proposé comme
-- sur le nom d'origine.

create or replace function documents_search_vector_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('french', extensions.unaccent(
      regexp_replace(coalesce(new.filename_ai, ''), '[_./\\-]+', ' ', 'g')
    )), 'A') ||
    setweight(to_tsvector('french', extensions.unaccent(
      regexp_replace(new.filename_original, '[_./\\-]+', ' ', 'g')
    )), 'B') ||
    setweight(to_tsvector('french', extensions.unaccent(
      regexp_replace(coalesce(new.extracted_data::text, ''), '[_./\\-]+', ' ', 'g')
    )), 'C');
  return new;
end;
$$;

revoke execute on function public.documents_search_vector_update() from public, anon, authenticated;

-- Réindexation des documents existants : le déclencheur s'exécute sur toute
-- mise à jour de ces colonnes, même à valeur identique.
update documents set filename_original = filename_original;
