-- Durcissement des droits (audit de sécurité du 2026-11-11).
--
-- · Un utilisateur pouvait supprimer sa ligne `profiles` directement par
--   l'API de la base : tout partait en cascade sans que l'abonnement Stripe
--   soit arrêté. La suppression passe par /api/account/delete, seule.
-- · Le titulaire d'un foyer pouvait supprimer directement un lien
--   `family_members` : le membre gardait Premium à vie et la place se
--   libérait. Le retrait passe par /api/household, qui retire la formule.
-- · `rate_limits` : droits inutiles (la table n'est écrite que par la
--   fonction `consume_rate_limit`).
-- · TRUNCATE / REFERENCES / TRIGGER n'ont rien à faire entre les mains des
--   rôles de l'API.

revoke delete on profiles from authenticated;
revoke delete on family_members from authenticated;
revoke all on rate_limits from anon, authenticated;
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;

create index if not exists alerts_ref_idx on alerts (ref_type, ref_id);
create index if not exists subscriptions_provider_idx on subscriptions (provider_id) where provider_id is not null;
