-- Numéro du service client, pour « Négocier avant de partir ».
--
-- Seulement les numéros courts et stables des opérateurs, vérifiés : les
-- numéros des autres fournisseurs changent souvent et se contredisent d'un
-- site à l'autre. Sans numéro, la page explique où le trouver.

alter table known_providers add column contact_phone text;

update known_providers set contact_phone = '3900' where name = 'Orange';
update known_providers set contact_phone = '1023' where name = 'SFR';
update known_providers set contact_phone = '1064' where name = 'Bouygues Telecom';
update known_providers set contact_phone = '3244' where name in ('Free', 'Free Mobile');
