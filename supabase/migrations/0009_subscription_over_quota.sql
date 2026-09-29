-- Abonnements détectés au-delà du quota de la formule gratuite.
--
-- La limite de 5 abonnements suivis était définie mais jamais appliquée : le
-- pipeline d'ingestion créait les lignes sans consulter le quota. Plutôt que de
-- jeter la détection, on la conserve, masquée : l'utilisateur voit qu'il en
-- existe d'autres, et un passage à une formule payante les révèle aussitôt,
-- sans avoir à retransférer ses e-mails.

alter table subscriptions
  add column if not exists over_quota boolean not null default false;

-- Le tableau de bord ne lit que les lignes visibles ; le compteur d'aperçu lit
-- les autres. Les deux requêtes filtrent sur ce couple.
create index if not exists subscriptions_user_visible_idx
  on subscriptions (user_id, over_quota);
