-- Verrouillage des écritures faites directement avec la clé publique.
--
-- Les policies RLS « for all » limitent les LIGNES qu'un utilisateur touche,
-- pas les COLONNES. Avec les droits par défaut de Supabase, n'importe quel
-- compte connecté pouvait donc, depuis la console de son navigateur :
--   · passer son profil en `plan = 'pro'` sans jamais payer ;
--   · remettre `over_quota = false` sur les abonnements masqués du gratuit ;
--   · insérer une alerte pointant vers l'abonnement d'un autre compte, en
--     contournant la vérification de propriété faite par l'API — le cron,
--     qui lit avec la clé de service, lui aurait envoyé les données d'autrui ;
--   · créer des tâches d'ingestion ou des documents hors quota.
--
-- Principe désormais : le client public ne peut écrire que les colonnes
-- qu'une personne a légitimement le droit de choisir. Tout le reste passe par
-- les routes serveur, qui vérifient avant d'écrire avec la clé de service.

-- anon n'a jamais de raison d'écrire quoi que ce soit.
revoke insert, update, delete on all tables in schema public from anon;

-- ---------------------------------------------------------------- profiles
revoke insert, update on profiles from authenticated;
-- `name` : le prénom affiché. `gmail_forward_verified` : l'utilisateur déclare
-- lui-même avoir fini l'onboarding, sans conséquence au-delà de son compte.
grant update (name, gmail_forward_verified) on profiles to authenticated;

-- ---------------------------------------------------------------- subscriptions
-- Création réservée au pipeline ; l'utilisateur corrige les champs extraits
-- via PATCH /api/subscriptions. `over_quota` et `user_id` restent serveur.
revoke insert, update on subscriptions from authenticated;
grant update (provider, amount, cycle, category, next_renewal, status,
              confirmed_by_user, confidence)
  on subscriptions to authenticated;

-- ---------------------------------------------------------------- le reste
-- Écrits uniquement par le serveur. La suppression reste permise sous RLS :
-- c'est l'utilisateur qui retire ses documents, abonnements et alertes.
revoke insert, update on documents      from authenticated;
revoke insert, update on alerts         from authenticated;
revoke insert, update on ingestion_jobs from authenticated;
revoke insert, update on cancellations  from authenticated;
revoke insert, update on family_members from authenticated;
revoke insert, update, delete on usage_counters from authenticated;
revoke insert, update, delete on known_providers from authenticated;
