-- Lien d'agenda (iCal) : Google Agenda, Apple Calendrier ou Outlook s'y
-- abonnent et affichent les échéances. Le jeton secret tient lieu de
-- connexion : l'agenda le lit sans session. Jamais lisible par un autre
-- compte (RLS du profil).
alter table profiles add column calendar_token text not null unique
  default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
