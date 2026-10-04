-- Présentation de bienvenue
--
-- Fenêtre affichée par-dessus l'application à la première connexion :
-- bienvenue, profil, mise en place du transfert, parrainage. Tant qu'elle
-- n'est pas terminée, elle revient à chaque nouvelle connexion.

alter table profiles add column tour_completed_at timestamptz;

-- Les comptes qui avaient déjà configuré leur transfert par l'ancien écran
-- ne la revoient pas.
update profiles set tour_completed_at = now() where gmail_forward_verified;

-- L'utilisateur déclare lui-même avoir terminé, sans conséquence au-delà de
-- son compte (même principe que `gmail_forward_verified`).
grant update (tour_completed_at) on profiles to authenticated;
