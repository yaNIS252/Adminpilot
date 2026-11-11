-- Notification de chaque nouvel abonnement détecté.
--
-- Une alerte `new_subscription` par abonnement apparu, lue dans l'appli
-- (pastille) et envoyée par e-mail dans un récapitulatif quotidien unique.
-- Rien pendant l'import groupé de l'historique (`ingestion_jobs.bulk`) ni
-- pendant la présentation de bienvenue : ce serait une rafale.

alter table alerts drop constraint if exists alerts_kind_check;
alter table alerts add constraint alerts_kind_check
  check (kind in ('deadline', 'price_change', 'manual', 'new_subscription'));

-- Vue dans l'application : la pastille disparaît. L'utilisateur la pose
-- lui-même, sans conséquence au-delà de son compte (RLS « alerts: own »).
alter table alerts add column read_at timestamptz;
grant update (read_at) on alerts to authenticated;

-- Interrupteur dans les réglages.
alter table profiles add column notify_new_subscription boolean not null default true;

-- E-mail arrivé par l'import groupé de l'historique.
alter table ingestion_jobs add column bulk boolean not null default false;
