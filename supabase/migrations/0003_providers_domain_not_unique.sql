-- Un même domaine héberge plusieurs produits distincts, chacun avec sa propre
-- offre, sa base légale et sa procédure de résiliation : bouyguestelecom.fr
-- porte Bouygues Telecom ET B&You, apple.com porte Apple TV+ ET iCloud.
-- L'identité d'un fournisseur est son slug, pas son domaine.
alter table known_providers drop constraint known_providers_domain_key;
create index known_providers_domain_idx on known_providers (domain);
