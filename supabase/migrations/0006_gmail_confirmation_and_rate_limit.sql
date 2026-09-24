-- 1. Code de confirmation Gmail
--
-- Il était jusqu'ici rangé dans `alerts` avec ref_type='subscription' et
-- ref_id pointant sur un profil — un détournement de table qui ne tenait que
-- parce qu'aucune contrainte ne l'interdisait. Ce code est un état transitoire
-- du profil, pas une alerte : il appartient à `profiles`.
alter table profiles
  add column gmail_confirmation    jsonb,
  add column gmail_confirmation_at timestamptz;

-- 2. Limitation de débit
--
-- Compteur par fenêtre glissante, en base plutôt que via un service externe :
-- pas de dépendance supplémentaire, et l'atomicité vient de Postgres.
create table rate_limits (
  bucket       text        not null,
  window_start timestamptz not null,
  count        int         not null default 0,
  primary key (bucket, window_start)
);

alter table rate_limits enable row level security;
-- Aucune policy : accessible uniquement par la service role key.

create or replace function consume_rate_limit(
  p_bucket text, p_limit int, p_window_secs int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count  int;
begin
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_secs) * p_window_secs
  );

  insert into rate_limits (bucket, window_start, count)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start)
  do update set count = rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke execute on function consume_rate_limit(text, int, int) from public, anon, authenticated;

create or replace function purge_rate_limits()
returns void
language sql
security definer
set search_path = public
as $$
  delete from rate_limits where window_start < now() - interval '1 day';
$$;

revoke execute on function purge_rate_limits() from public, anon, authenticated;
