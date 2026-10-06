-- Ce que l'IA a compris de chaque e-mail (type, fournisseur, confiance) :
-- sans lui, impossible de savoir pourquoi un e-mail n'a rien donné. Aucune
-- donnée personnelle : le contenu reste dans le stockage, purgé à 30 jours.
alter table ingestion_jobs add column result jsonb;
