-- Incrément atomique d'un compteur de quota.
--
-- Un lire-puis-écrire côté application laisserait passer deux actions
-- concurrentes du même utilisateur sur le dernier quota disponible.
-- Le upsert Postgres règle la course en une seule instruction.
--
-- `p_column` est contraint à une liste fermée : c'est un nom d'identifiant
-- interpolé dans du SQL dynamique, il ne doit jamais venir librement du client.
create or replace function increment_usage(
  p_user_id uuid,
  p_period  text,
  p_column  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_column not in ('alerts_count', 'searches_count', 'cancellations_count') then
    raise exception 'colonne de compteur invalide: %', p_column;
  end if;

  execute format(
    'insert into usage_counters (user_id, period, %1$I)
     values ($1, $2, 1)
     on conflict (user_id, period)
     do update set %1$I = usage_counters.%1$I + 1',
    p_column
  ) using p_user_id, p_period;
end;
$$;

revoke execute on function increment_usage(uuid, text, text) from public, anon, authenticated;
