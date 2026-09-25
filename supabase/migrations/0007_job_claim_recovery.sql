-- Récupération des jobs bloqués en cours de traitement.
--
-- Le drain faisait passer un job en `processing` avant de travailler, ce qui
-- empêche bien deux exécutions concurrentes de le traiter deux fois. Mais rien
-- ne le ramenait en file si l'exécution mourait au milieu — expiration de la
-- fonction serverless, redéploiement, plantage du modèle. Le job restait
-- `processing` pour toujours, et `claimPendingJobs` ne regarde que `pending` et
-- `failed` : le document disparaissait sans trace pour l'utilisateur, qui l'a
-- pourtant vu partir.
--
-- `claimed_at` date la réservation. Au-delà d'un délai franchement supérieur au
-- `maxDuration` de la route, le job est considéré abandonné et reprenable.

alter table ingestion_jobs
  add column if not exists claimed_at timestamptz;

-- Le drain trie par ancienneté parmi les jobs reprenables : sans cet index,
-- chaque passage fait un parcours complet de la table.
create index if not exists ingestion_jobs_drain_idx
  on ingestion_jobs (status, attempts, created_at);

-- Les reprises interrogent `claimed_at` sur les seuls jobs en cours.
create index if not exists ingestion_jobs_stale_idx
  on ingestion_jobs (claimed_at)
  where status = 'processing';
