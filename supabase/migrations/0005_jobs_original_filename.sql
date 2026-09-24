-- Le nom de fichier d'origine doit survivre au passage par R2, où la clé est
-- dérivée du hash de contenu. Il sert deux fois : comme indice au modèle lors
-- de la classification (« Facture_EDF_aout.pdf » oriente utilement), et comme
-- valeur de `documents.filename_original`, que l'utilisateur doit reconnaître.
alter table ingestion_jobs add column original_filename text;
