-- Documents en attente : facture jointe à un e-mail d'un expéditeur inconnu
-- (capté par le filtre « mots-clés »). Rien n'est rangé sans l'accord de
-- l'utilisateur : le document attend « Garder » ou « Ignorer », et disparaît
-- seul au bout de 30 jours (`pending_until`). Tant qu'il attend, il ne compte
-- ni dans le quota, ni dans la recherche, ni dans les totaux.

alter table ingestion_jobs add column pending_document boolean not null default false;

alter table documents add column pending_until timestamptz;
create index documents_pending_idx on documents (user_id, pending_until)
  where pending_until is not null;
