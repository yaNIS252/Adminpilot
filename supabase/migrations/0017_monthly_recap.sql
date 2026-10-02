-- Récapitulatif mensuel par e-mail (formules payantes).

alter table profiles
  -- Désactivable depuis les réglages ; chaque e-mail le rappelle.
  add column monthly_recap boolean not null default true,
  -- Dernière période envoyée (`YYYY-MM`) : posée AVANT l'envoi, elle garantit
  -- qu'un même récapitulatif ne part jamais deux fois, même si la tâche est
  -- relancée.
  add column last_recap_period text;
