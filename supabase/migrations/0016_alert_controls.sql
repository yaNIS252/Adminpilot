-- Maîtrise des alertes par l'utilisateur.

-- Rappels manuels : envoyés avec le titre et le message saisis, quelle que
-- soit l'échéance connue de l'objet (le gabarit « échéance » exigeait une
-- date de renouvellement, si bien qu'un rappel manuel sur un abonnement sans
-- date ne partait jamais).
alter table alerts drop constraint alerts_kind_check;
alter table alerts add constraint alerts_kind_check
  check (kind in ('deadline', 'price_change', 'manual'));

-- Rappels d'échéance coupés pour un abonnement : plus aucun J-7 / J-1 n'est
-- programmé. Les alertes de hausse de prix, elles, restent actives.
alter table subscriptions
  add column reminders_muted boolean not null default false;

grant update (reminders_muted) on subscriptions to authenticated;
