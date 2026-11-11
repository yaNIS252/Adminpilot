-- Analyse des abonnements : offres de référence pour l'énergie, la box, le
-- mobile et l'assurance, dans la table `offers` existante (une seule source de
-- prix pour « Négocier » et « Analyse »). Les clics restent dans `offer_clicks`.
--
-- AUCUN PRIX N'EST INVENTÉ : les lignes ci-dessous sont inactives, à 0 €,
-- marquées « à vérifier ». Elles ne s'affichent qu'une fois remplies avec de
-- vraies données et passées à `active = true`.

alter table offers add column kind text check (kind is null or kind in ('box', 'mobile'));
-- Conditions structurées : kVA, débit, data, engagement…
alter table offers add column details jsonb not null default '{}'::jsonb;
-- Tarif de référence (le tarif réglementé de l'électricité, par exemple).
alter table offers add column is_reference boolean not null default false;

insert into offers (category, kind, provider_name, name, monthly_price, conditions, details, url, active, is_reference, checked_at) values
  ('energie', null, 'EDF', 'Tarif Bleu (tarif réglementé), option Base', 0, 'À VÉRIFIER : prix à reprendre de la grille officielle en vigueur', '{"kva": 6, "option": "base", "a_verifier": true}', 'https://www.cre.fr', false, true, current_date),
  ('telecom', 'box', 'À renseigner', 'Offre box fibre de référence', 0, 'À VÉRIFIER : prix, débit, engagement', '{"debit": null, "engagement_mois": null, "a_verifier": true}', 'https://www.arcep.fr', false, false, current_date),
  ('telecom', 'mobile', 'À renseigner', 'Forfait mobile de référence', 0, 'À VÉRIFIER : prix, data, engagement', '{"data_go": null, "engagement_mois": null, "a_verifier": true}', 'https://www.arcep.fr', false, false, current_date),
  ('assurance', null, 'À renseigner', 'Assurance habitation de référence', 0, 'À VÉRIFIER : prix, garanties, franchise', '{"type": "habitation", "a_verifier": true}', 'https://www.economie.gouv.fr', false, false, current_date);
