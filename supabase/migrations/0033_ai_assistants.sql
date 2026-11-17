-- Assistants d'IA payants : absents du catalogue, leurs reçus n'étaient pas
-- transférés par le filtre Gmail. Leurs reçus arrivent souvent par Stripe
-- (voir BILLING_PLATFORM_DOMAINS) ; le domaine du site sert au filtre et au
-- lien « site du fournisseur ». Aucun lien de résiliation tant qu'il n'a pas
-- été vérifié à la main.
insert into known_providers (name, domain, sender_emails, category, cancel_method, legal_basis, seo_slug)
values
  ('Claude', 'anthropic.com', '{}', 'logiciel', 'en_ligne', 'libre', 'claude'),
  ('ChatGPT', 'openai.com', '{}', 'logiciel', 'en_ligne', 'libre', 'chatgpt'),
  ('Le Chat', 'mistral.ai', '{}', 'logiciel', 'en_ligne', 'libre', 'le-chat-mistral')
on conflict (seo_slug) do nothing;
