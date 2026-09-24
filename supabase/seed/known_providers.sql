-- Catalogue des fournisseurs connus. Rejouable : `on conflict do nothing`.
--
-- Table pivot du produit : elle sert au filtrage d'ingestion, au moteur de
-- résiliation ET à la génération des pages SEO /resilier/[slug].
--
-- legal_basis :
--   hamon          résiliation à tout moment après un an (assurances, L221-10)
--   chatel         reconduction tacite avec préavis (L215-1)
--   infra_annuelle santé / mutuelle (L113-15-2)
--   libre          sans engagement, résiliable à tout moment
--
-- Un domaine peut porter plusieurs produits (bouyguestelecom.fr → Bouygues et
-- B&You) : l'identité d'un fournisseur est son slug.

insert into known_providers (name, domain, sender_emails, category, cancel_method, cancel_url, legal_basis, seo_slug) values
  ('Allianz', 'allianz.fr', array['contact@allianz.fr'], 'assurance', 'courrier', null, 'hamon', 'allianz'),
  ('AXA', 'axa.fr', array['contact@axa.fr'], 'assurance', 'courrier', null, 'hamon', 'axa'),
  ('Generali', 'generali.fr', array['contact@generali.fr'], 'assurance', 'courrier', null, 'hamon', 'generali'),
  ('Groupama', 'groupama.fr', array['contact@groupama.fr'], 'assurance', 'courrier', null, 'hamon', 'groupama'),
  ('MACIF', 'macif.fr', array['contact@macif.fr'], 'assurance', 'courrier', null, 'hamon', 'macif'),
  ('MAIF', 'maif.fr', array['contact@maif.fr'], 'assurance', 'courrier', null, 'hamon', 'maif'),
  ('Matmut', 'matmut.fr', array['contact@matmut.fr'], 'assurance', 'courrier', null, 'hamon', 'matmut'),
  ('MMA', 'mma.fr', array['contact@mma.fr'], 'assurance', 'courrier', null, 'hamon', 'mma'),
  ('BNP Paribas', 'bnpparibas.net', array['contact@bnpparibas.net'], 'banque', 'courrier', null, 'libre', 'bnp-paribas'),
  ('Boursorama', 'boursorama.com', array['noreply@boursorama.com'], 'banque', 'en_ligne', null, 'libre', 'boursorama'),
  ('Crédit Agricole', 'credit-agricole.fr', array['contact@credit-agricole.fr'], 'banque', 'courrier', null, 'libre', 'credit-agricole'),
  ('Fortuneo', 'fortuneo.fr', array['contact@fortuneo.fr'], 'banque', 'en_ligne', null, 'libre', 'fortuneo'),
  ('LCL', 'lcl.fr', array['contact@lcl.fr'], 'banque', 'courrier', null, 'libre', 'lcl'),
  ('N26', 'n26.com', array['support@n26.com'], 'banque', 'en_ligne', null, 'libre', 'n26'),
  ('Revolut', 'revolut.com', array['noreply@revolut.com'], 'banque', 'en_ligne', null, 'libre', 'revolut'),
  ('Société Générale', 'societegenerale.fr', array['contact@societegenerale.fr'], 'banque', 'courrier', null, 'libre', 'societe-generale'),
  ('EDF', 'edf.fr', array['contact@edf.fr','noreply@edf.fr'], 'energie', 'en_ligne', 'https://particulier.edf.fr', 'libre', 'edf'),
  ('Ekwateur', 'ekwateur.fr', array['bonjour@ekwateur.fr'], 'energie', 'en_ligne', null, 'libre', 'ekwateur'),
  ('Engie', 'engie.fr', array['contact@engie.fr'], 'energie', 'en_ligne', 'https://particuliers.engie.fr', 'libre', 'engie'),
  ('Eni', 'eni.com', array['service.clients@eni.com'], 'energie', 'en_ligne', null, 'libre', 'eni'),
  ('TotalEnergies', 'totalenergies.fr', array['clients@totalenergies.fr'], 'energie', 'en_ligne', null, 'libre', 'totalenergies'),
  ('Vattenfall', 'vattenfall.fr', array['service-client@vattenfall.fr'], 'energie', 'en_ligne', null, 'libre', 'vattenfall'),
  ('Century 21', 'century21.fr', array['contact@century21.fr'], 'logement', 'courrier', null, 'libre', 'century-21'),
  ('Foncia', 'foncia.com', array['contact@foncia.com'], 'logement', 'courrier', null, 'libre', 'foncia'),
  ('Nexity', 'nexity.fr', array['contact@nexity.fr'], 'logement', 'courrier', null, 'libre', 'nexity'),
  ('Adobe', 'adobe.com', array['mail@mail.adobe.com'], 'logiciel', 'en_ligne', null, 'chatel', 'adobe'),
  ('Amazon Prime', 'amazon.fr', array['no-reply@amazon.fr'], 'logiciel', 'en_ligne', null, 'libre', 'amazon-prime'),
  ('Deliveroo Plus', 'deliveroo.fr', array['noreply@deliveroo.fr'], 'logiciel', 'en_ligne', null, 'libre', 'deliveroo-plus'),
  ('iCloud', 'apple.com', array['no_reply@email.apple.com'], 'logiciel', 'en_ligne', null, 'libre', 'icloud'),
  ('Microsoft 365', 'microsoft.com', array['account-security-noreply@accountprotection.microsoft.com'], 'logiciel', 'en_ligne', null, 'libre', 'microsoft-365'),
  ('Uber One', 'uber.com', array['noreply@uber.com'], 'logiciel', 'en_ligne', null, 'libre', 'uber-one'),
  ('Apple TV+', 'apple.com', array['no_reply@email.apple.com'], 'streaming', 'en_ligne', null, 'libre', 'apple-tv-plus'),
  ('Canal+', 'canalplus.com', array['contact@canalplus.com'], 'streaming', 'courrier', null, 'chatel', 'canal-plus'),
  ('Deezer', 'deezer.com', array['noreply@deezer.com'], 'streaming', 'en_ligne', null, 'libre', 'deezer'),
  ('Disney+', 'disneyplus.com', array['disneyplus@mail.disneyplus.com'], 'streaming', 'en_ligne', null, 'libre', 'disney-plus'),
  ('Netflix', 'netflix.com', array['info@mailer.netflix.com'], 'streaming', 'en_ligne', 'https://www.netflix.com/cancelplan', 'libre', 'netflix'),
  ('Prime Video', 'primevideo.com', array['no-reply@amazon.fr'], 'streaming', 'en_ligne', null, 'libre', 'prime-video'),
  ('Spotify', 'spotify.com', array['no-reply@spotify.com'], 'streaming', 'en_ligne', 'https://www.spotify.com/account', 'libre', 'spotify'),
  ('YouTube Premium', 'youtube.com', array['noreply@youtube.com'], 'streaming', 'en_ligne', null, 'libre', 'youtube-premium'),
  ('B&You', 'bouyguestelecom.fr', array['noreply@bouyguestelecom.fr'], 'telecom', 'en_ligne', null, 'libre', 'b-and-you'),
  ('Bouygues Telecom', 'bouyguestelecom.fr', array['contact@bouyguestelecom.fr'], 'telecom', 'en_ligne', null, 'chatel', 'bouygues-telecom'),
  ('Free', 'free.fr', array['noreply@free.fr','freebox@free.fr'], 'telecom', 'en_ligne', 'https://subscribe.free.fr', 'chatel', 'free'),
  ('Free Mobile', 'mobile.free.fr', array['noreply@mobile.free.fr'], 'telecom', 'en_ligne', 'https://mobile.free.fr', 'chatel', 'free-mobile'),
  ('Orange', 'orange.fr', array['contact@orange.fr','noreply@orange.fr'], 'telecom', 'en_ligne', 'https://espaceclientv3.orange.fr', 'chatel', 'orange'),
  ('Prixtel', 'prixtel.com', array['contact@prixtel.com'], 'telecom', 'en_ligne', null, 'libre', 'prixtel'),
  ('RED by SFR', 'red-by-sfr.fr', array['noreply@red-by-sfr.fr'], 'telecom', 'en_ligne', null, 'libre', 'red-by-sfr'),
  ('SFR', 'sfr.fr', array['noreply@sfr.fr','contact@sfr.fr'], 'telecom', 'en_ligne', 'https://www.sfr.fr/mon-compte', 'chatel', 'sfr'),
  ('Sosh', 'sosh.fr', array['noreply@sosh.fr'], 'telecom', 'en_ligne', null, 'libre', 'sosh'),
  ('Navigo', 'iledefrance-mobilites.fr', array['contact@iledefrance-mobilites.fr'], 'transport', 'en_ligne', null, 'libre', 'navigo'),
  ('SNCF Connect', 'sncf-connect.com', array['noreply@sncf-connect.com'], 'transport', 'en_ligne', null, 'libre', 'sncf-connect'),
  ('Uber', 'uber.com', array['noreply@uber.com'], 'transport', 'en_ligne', null, 'libre', 'uber'),
  ('Vélib', 'velib-metropole.fr', array['contact@velib-metropole.fr'], 'transport', 'en_ligne', null, 'libre', 'velib')
on conflict (seo_slug) do nothing;
