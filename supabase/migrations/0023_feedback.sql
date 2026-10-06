-- Avis des utilisateurs
--
-- Demandé dans l'application au bout de deux semaines, puis par e-mail au
-- bout d'un mois si l'utilisateur n'a pas encore répondu. Un seul avis par
-- compte, modifiable : il vit donc dans le profil, ce qui l'inclut d'office
-- dans l'export et la suppression du compte.

alter table profiles
  add column feedback_rating smallint check (feedback_rating between 1 and 5),
  add column feedback_comment text check (char_length(feedback_comment) <= 2000),
  add column feedback_at timestamptz,
  -- Carte « Ton avis » refermée sans répondre : elle ne revient plus, l'e-mail
  -- d'un mois part quand même.
  add column feedback_dismissed_at timestamptz,
  -- Posé AVANT l'envoi (même principe que `last_recap_period`).
  add column feedback_email_sent_at timestamptz;
