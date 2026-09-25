-- Réservation atomique des jobs d'ingestion.
--
-- Remplace le couple SELECT puis UPDATE du code applicatif. Deux raisons :
--
--  1. `for update skip locked` est la primitive prévue par Postgres pour une
--     file de travail. Deux drains concurrents ne voient jamais les mêmes
--     lignes, là où le SELECT/UPDATE reposait sur le fait que le perdant de la
--     course ne retrouve plus son filtre — vrai, mais fragile au premier
--     changement de filtre.
--
--  2. Une reprise après abandon doit consommer une tentative. Sans ça, un job
--     qui fait systématiquement expirer la fonction serverless serait rejoué
--     toutes les quinze minutes, indéfiniment, et chaque reprise coûte un appel
--     au modèle. Impossible à exprimer dans un UPDATE groupé côté client, le
--     `attempts + 1` devant être calculé ligne par ligne.

create or replace function claim_ingestion_jobs(
  p_limit         int default 10,
  p_max_attempts  int default 3,
  p_stale_seconds int default 900
)
returns setof ingestion_jobs
language sql
security definer
set search_path = public
as $$
  update ingestion_jobs j
     set status     = 'processing',
         claimed_at = now(),
         attempts   = case
                        when j.status = 'processing' then j.attempts + 1
                        else j.attempts
                      end
   where j.id in (
     select id
       from ingestion_jobs
      where attempts < p_max_attempts
        and (
          status in ('pending', 'failed')
          or (
            status = 'processing'
            and claimed_at < now() - make_interval(secs => p_stale_seconds)
          )
        )
      order by created_at
      limit p_limit
      for update skip locked
   )
  returning j.*;
$$;

-- `security definer` contourne RLS : la fonction ne doit être appelable que par
-- le rôle de service, jamais depuis une session utilisateur. Sans cette
-- révocation, n'importe quel porteur de la clé publique pourrait réserver — et
-- donc lire — les jobs de tout le monde.
revoke execute on function claim_ingestion_jobs(int, int, int) from public;
revoke execute on function claim_ingestion_jobs(int, int, int) from anon;
revoke execute on function claim_ingestion_jobs(int, int, int) from authenticated;
grant  execute on function claim_ingestion_jobs(int, int, int) to service_role;
