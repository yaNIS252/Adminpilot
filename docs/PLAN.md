# AdminPilot — Plan de build (version fusionnée)

> Fusion du `ADMINPILOT-CLAUDE-CODE-PLAN.md` (détail produit, composants, seed fournisseurs, conventions) et du plan d'architecture (corrections structurantes, pipeline async, conformité).
> Document de référence unique. En cas de contradiction avec l'artifact business plan ou le plan Claude Code d'origine, **c'est ce fichier qui fait foi**.

---

## 1. Ce qui a été corrigé par rapport au plan d'origine

Six points du plan d'origine ne survivent pas au contact du réel. Chacun est remplacé, pas supprimé — l'objectif produit reste identique.

| # | Plan d'origine | Problème | Remplacé par |
|---|---|---|---|
| 1 | **Scan Gmail via OAuth `gmail.readonly` dès le jour 4** | *Restricted scope* Google : au-delà de 100 users en mode test, vérification OAuth (6-10 semaines) **+ audit sécurité tiers agréé (15-75K$)**. Incompatible avec le budget et le calendrier. | **Adresse de réception dédiée** par utilisateur (`u-7f3a9c@in.adminpilot.fr`) + filtre de transfert Gmail. Zéro OAuth. Dossier de vérification Google ouvert en parallèle en S2 → Gmail natif en V2. |
| 2 | **OCR Tesseract.js** | Inutile, et médiocre sur des factures françaises. | Claude lit nativement les PDF (bloc `document`, base64, ≤100 pages sur modèle 200K) et les images. Un bloc entier disparaît. |
| 3 | **Prisma + Supabase** | Prisma court-circuite les Row Level Security policies. Sur des mails et factures, RLS Postgres est la seule protection qui survit à un bug applicatif. | `supabase-js` + migrations SQL versionnées + types TS générés (`supabase gen types`). |
| 4 | **`user.gmailToken` chiffré en base** | Stocker des refresh tokens Google = la donnée la plus toxique du produit. | Supprimé du MVP. L'ingestion par transfert ne demande aucun token. Problème éliminé, pas mitigé. |
| 5 | **Prompt « réponds UNIQUEMENT en JSON valide »** | Parsing défensif, échecs silencieux, dérive au moindre changement de prompt. | **Structured outputs** (`output_config.format`) — schéma garanti valide par l'API. |
| 6 | **« Batch les appels Claude : 10 emails en 1 appel »** | Contamination croisée entre emails, et un échec fait tomber les 10. | **Batch API Anthropic** (‑50%, asynchrone, 1 email = 1 requête, résultats indexés par `custom_id`). Le vrai levier de coût, sans le risque. |

**Correction juridique** : le comparateur rémunéré (20-50€/switch) en assurance = intermédiation en assurance → immatriculation **ORIAS** + RC pro obligatoires. Le comparateur reste **informatif et non rémunéré** jusqu'au lancement.

Tout le reste du plan d'origine est conservé : structure de fichiers, enums, `KnownProvider`, seed fournisseurs, plan-gate, templates d'alertes, SEO programmatique, conventions de code.

---

## 2. Stack (versions vérifiées le 22/09/2026)

| Couche | Techno | Note |
|---|---|---|
| Framework | **Next.js 16.3.6** (App Router) + React 19.2 | le plan d'origine disait 14 — deux majeures de retard |
| Langage | TypeScript strict | — |
| DB / Auth / Storage | Supabase, Postgres 17, **RLS sur toutes les tables** | Prisma retiré |
| IA | `@anthropic-ai/sdk` 0.128 — `claude-haiku-4-5` | 200K contexte, 1$/5$ par MTok |
| Escalade IA | `claude-sonnet-5` si `confidence < 0.7` | ~10% du volume |
| Ingestion mail | Cloudflare Email Routing → Worker → webhook (HMAC) | remplace l'OAuth Gmail |
| Stockage fichiers | Cloudflare R2 (URLs signées 1h, jamais public) | — |
| Paiement | Stripe 22.6 | — |
| Emails sortants | Resend | — |
| PDF | `@react-pdf/renderer` | pas Puppeteer : inexploitable en serverless Vercel |
| UI | Tailwind CSS v4 + shadcn/ui | — |
| Validation | Zod (schémas partagés front/back/IA) | — |
| Rate limiting | Upstash Ratelimit | — |
| Monitoring | Vercel Analytics + Sentry | — |

**Pas d'OCR, pas de Prisma, pas de pgvector au MVP.** Recherche full-text Postgres (`tsvector`) d'abord ; embeddings seulement si elle plafonne.

**Note modèle** : Haiku 4.5 rejette `output_config.effort`. Pour de la classification : pas de thinking, `max_tokens: 1024`, prompt caching sur le préfixe système stable.

---

## 3. Prérequis bloquants

| Sujet | État | Action |
|---|---|---|
| Domaine `adminpilot.fr` | à acheter | Requis pour les MX (ingestion) et le SEO. Réserver aussi le .com. |
| Supabase | **org `intent saas` en plan free, 2 projets actifs = plafond** | Mettre `Formintent` en pause **ou** passer l'org en Pro (25$/mois). Sans ça, pas de projet AdminPilot. |
| SIREN | à créer | Micro-entreprise suffit. **Sans SIREN, pas de Stripe, pas d'encaissement.** Délai 1-2 semaines → lancer en S1. |
| Clé API Anthropic | à vérifier | ~0,002€ par email classifié. |
| Cloudflare | à créer | Email Routing (gratuit) + R2. |

Environnement local vérifié : Node v24.20.0, npm 11.7.0, git 2.46.2.

---

## 4. Architecture — le pipeline unique

Mail transféré et document uploadé **convergent dans le même pipeline**. C'est ce qui rend le scope tenable : un seul chemin à construire, tester et fiabiliser.

```
Source A : mail → MX in.adminpilot.fr → Cloudflare Email Routing
                → Worker (parse MIME) → POST /api/inbound (signé HMAC)
Source B : upload → POST /api/docs/upload (session authentifiée)

                    ↓ convergence ↓

  1. Résolution user (inbox_token, ou session)
  2. Dédup SHA-256 (Message-ID pour le mail, contenu pour le fichier)
  3. Stockage du brut sur R2, chiffré
  4. INSERT ingestion_jobs (status='pending')  → réponse 202 immédiate
  5. Cron /api/cron/process-jobs (chaque minute) draine la file
  6. Claude Haiku 4.5, structured output strict → confidence
  7. Écriture subscriptions / documents
  8. confidence < 0.7 → escalade Sonnet 5 ; < 0.4 → file de revue manuelle
```

**Pourquoi async** : une route serverless expire. Et le jour où on rejoue 6 mois d'historique, on bascule la file sur la Batch API (‑50%) sans réécrire une ligne.

### L'astuce d'onboarding

Gmail exige une validation pour tout transfert automatique : il envoie **un code à l'adresse de destination** — donc chez nous. On le détecte dans le pipeline, on l'affiche en direct (Supabase Realtime) et on propose le lien de confirmation en un clic.

L'onboarding devient : coller l'adresse dans Gmail → le code apparaît seul → cliquer. **C'est la pièce la plus critique du produit** : c'est là que se joue le taux d'activation, et c'est la seule hypothèse capable de tuer AdminPilot.

---

## 5. Schéma de données

Enums repris du plan d'origine, tables complétées (idempotence, quotas, confiance, RGPD).

```sql
-- enums
plan              : free | pro | family
billing_cycle     : monthly | yearly | quarterly | weekly | one_time | unknown
sub_status        : active | cancelled | paused | expired | unknown
doc_category      : facture | contrat | assurance | impots | banque | logement
                    | sante | vehicule | identite | travail | autre
alert_channel     : email | push | both
cancel_status     : draft | generated | sent | confirmed
job_status        : pending | processing | done | failed | needs_review

profiles          id(=auth.users), email, name, plan, stripe_customer_id,
                  stripe_sub_id, inbox_token UNIQUE, gmail_forward_verified,
                  created_at, deleted_at

ingestion_jobs    id, user_id, source('email'|'upload'), raw_url, mime_type,
                  content_hash, status, attempts, error,
                  model_used, tokens_in, tokens_out, created_at
                  UNIQUE(user_id, content_hash)          ← idempotence

subscriptions     id, user_id, provider, provider_id→known_providers,
                  amount, currency, cycle, category, next_renewal, status,
                  confidence, confirmed_by_user, source_job_id,
                  detected_at, cancelled_at, metadata JSONB

documents         id, user_id, file_url, file_size, mime_type,
                  filename_original, filename_ai, category,
                  extracted_data JSONB, deadline, confidence,
                  source_job_id, search_vector tsvector, created_at

alerts            id, user_id, ref_type('subscription'|'document'),
                  ref_id, title, message, alert_date, channel,
                  sent_at, dedup_key UNIQUE                ← anti double-envoi

cancellations     id, user_id, subscription_id UNIQUE, template_used,
                  letter_content, letter_url, status, sent_at

family_members    id, owner_id, email, name, invited_at, joined_at
                  UNIQUE(owner_id, email)

known_providers   id, name, domain UNIQUE, sender_emails[], category,
                  cancel_method('courrier'|'email'|'en_ligne'),
                  cancel_address, cancel_email, cancel_url,
                  legal_basis('hamon'|'chatel'|'infra_annuelle'|'libre'),
                  seo_slug                                 ← alimente /resilier/[slug]

usage_counters    user_id, period(YYYY-MM), subscriptions_count, docs_count,
                  alerts_count, searches_count, cancellations_count
                  PRIMARY KEY(user_id, period)
```

**RLS sur toutes les tables** : `user_id = auth.uid()`. `known_providers` en lecture publique. Les écritures du pipeline passent par la service role key, **serveur uniquement**.

`known_providers` est la table pivot : elle sert au filtrage d'ingestion, au moteur de résiliation **et** à la génération des pages SEO. Une seule source de vérité.

---

## 6. Arborescence

```
src/
  app/
    (marketing)/  page.tsx · pricing · resilier/[slug]/page.tsx (SEO, 200+ pages)
    (auth)/       login · callback/route.ts
    (dashboard)/  layout.tsx (sidebar → bottom-nav mobile)
                  page.tsx · subscriptions · documents · alerts
                  cancel · settings · onboarding
    api/
      inbound/route.ts              webhook Cloudflare, HMAC obligatoire
      docs/upload · docs/search
      subscriptions/route.ts
      cancel/generate/route.ts
      alerts/route.ts
      cron/process-jobs/route.ts    chaque minute — draine la file
      cron/send-alerts/route.ts     8h — envoi des alertes
      webhooks/stripe/route.ts
  components/
    ui/           shadcn
    dashboard/    stats-cards · subscription-list · document-grid
                  upcoming-deadlines · search-bar · review-queue
    cancel/       cancel-wizard · letter-preview
    shared/       sidebar · file-upload · plan-gate · confidence-badge
  lib/
    supabase/     client · server · admin · types(généré)
    ai/           client · schemas(Zod) · extract · classify · search · letter
    ingest/       pipeline · dedupe · parse-mime
    r2/           upload · signed-url · delete
    billing/      stripe · quotas
    cancel/       templates · generate-pdf
    resend.ts · constants.ts
  prompts/        classify-email · classify-document
                  generate-cancel-letter · search-query
  types/ · utils/ (date · currency · hash)
supabase/migrations/   SQL versionné
supabase/seed/         known_providers.sql
workers/email-router/  Worker Cloudflare
scripts/eval-extract.ts
docs/PLAN.md
```

`src/lib/ai/schemas.ts` est la pièce centrale : **un seul jeu de schémas Zod** qui sert de contrat aux structured outputs Claude, de validation à l'insertion, et de types dans l'UI.

---

## 7. Séquencement — 8 semaines (temps plein)

### S1 — Fondations + pipeline d'ingestion
Next 16, projet Supabase, migrations + RLS, auth Google + magic link, middleware de protection. Domaine + MX Cloudflare + Worker email. Pipeline complet réception → dédup → R2 → job → Claude → `subscriptions`. Seed `known_providers`. Déploiement Vercel.
**Jalon : un mail transféré ressort en abonnement structuré en base.**

### S2 — Landing + onboarding + dashboard → alpha
Landing (hero, 3 features, pricing, footer). Wizard 3 étapes avec **capture du code de confirmation Gmail**. Dashboard : 4 cartes stats, liste d'abos triée par montant, timeline 30 jours, documents récents, barre de recherche. File de revue pour les extractions douteuses.
**Jalon : alpha privée à 10 personnes. Aha moment mesuré < 60s.**
*En parallèle : ouverture du dossier de vérification OAuth Google.*

### S3 — Alertes + coffre-fort documents
Création auto d'alertes (J‑7 et J‑1) à chaque abo ou document daté. Cron 8h → Resend, template responsive (« ⏰ [Provider] se renouvelle dans X jours »), dédup par `dedup_key`. Upload drag & drop + photo mobile, réutilisant le pipeline S1. Grille documents filtrable, preview inline. Recherche full-text.
**Jalon : une alerte réelle reçue avant une vraie échéance.**

### S4 — Résiliation + recherche NLP
Templates Hamon (L221‑18) / Chatel (L136‑1) / infra-annuelle (L113‑15‑2). Wizard 3 étapes, lettre éditable, PDF, archivage R2. Recherche langage naturel → filtres structurés. Comparateur V1 statique, **sans commission**.
**Jalon : une lettre conforme téléchargée.**

### S5 — Stripe + conformité
Checkout, portail client, webhooks (`checkout.session.completed`, `subscription.updated`, `subscription.deleted`, `invoice.payment_failed`). `plan-gate` + `usage_counters` (Free : 5 abos, 10 docs, 1 alerte, 5 recherches, 0 résiliation). Politique de confidentialité, CGU, registre des traitements, page « ce qu'on lit vs ce qu'on stocke », **export et suppression de compte** (obligation RGPD, pas une option). Responsive 375px.
**Jalon : premier paiement réel encaissé.**

### S6 — Bêta 50 + instrumentation
50 bêta-testeurs. Mesure : activation, délai jusqu'au premier abo détecté, précision d'extraction sur échantillon annoté. Chasse aux faux positifs. Sentry, rate limiting, CSP.
**Jalon : > 85% de précision d'extraction, > 60% d'activation.**

### S7‑S8 — SEO + lancement
`/resilier/[slug]` généré statiquement depuis `known_providers` (200+ pages, guide pas à pas + CTA). Sitemap, données structurées. **Aucune page publiée sans relecture humaine.** Product Hunt FR, premières vidéos TikTok.
**Jalon : lancement public.**

---

## 8. Seed `known_providers` (priorité)

```
Énergie    EDF · Engie · TotalEnergies · Eni · Vattenfall · Ekwateur
Télécom    Free · Orange · SFR · Bouygues · Sosh · RED · B&You · Prixtel
Streaming  Netflix · Disney+ · Prime Video · Canal+ · Apple TV+ · Spotify
           Deezer · YouTube Premium
Assurance  AXA · Allianz · MAIF · MACIF · Groupama · MMA · Generali · Matmut
Banque     BNP · SG · Crédit Agricole · LCL · Boursorama · Fortuneo · N26 · Revolut
Logement   Nexity · Foncia · Century21
Transport  SNCF · Navigo · Vélib · Uber
Autres     Amazon Prime · Deliveroo+ · UberOne · Adobe · Microsoft 365 · iCloud
```

Chaque entrée porte son adresse de résiliation, sa méthode, sa base légale et son slug SEO.

---

## 9. Vérification

### Le test qui compte — précision d'extraction
1. Constituer 30 emails réels annotés à la main : Netflix, EDF, Free, SFR, Spotify, assurance, mutuelle, impôts + **5 non-transactionnels à rejeter**.
2. `npm run eval:extract` rejoue le jeu et sort précision/rappel par champ.
3. Seuils : **> 90%** sur `provider` et `amount`, **> 80%** sur `next_renewal` (le plus dur — souvent absent, parfois seulement déductible du cycle).
4. **Rejouer à chaque modification de prompt.** Sans ce garde-fou, toute retouche est un pari.

### Bout en bout manuel
Créer un compte → récupérer l'adresse d'ingestion → transférer un vrai mail Netflix → vérifier l'apparition sous 60s → forcer `next_renewal` à J+3 → déclencher le cron d'alertes → vérifier la réception → générer la lettre → vérifier le PDF.

### Sécurité — avant toute ouverture publique
- Compte A connecté, tenter de lire une ligne du compte B via l'API REST Supabase directe. **Doit renvoyer vide, sur chaque table.**
- `grep -r SUPABASE_SERVICE_ROLE_KEY .next/static` → aucun résultat.
- `/api/inbound` rejette toute requête sans HMAC valide.
- Advisors Supabase (sécurité + performance) au vert.

### Paiement
Stripe en mode test : souscription, changement de plan, annulation, échec de carte. Vérifier que les quotas se rétablissent au downgrade.

---

## 10. Risques

| Risque | Sévérité | Traitement |
|---|---|---|
| **L'utilisateur n'arrive pas à configurer le transfert Gmail** | Élevé | Point de rupture n°1. D'où la capture auto du code. Mesurer dès l'alpha : **si < 50% d'activation, tout repenser avant de dépenser un euro en acquisition.** |
| **Comparateur rémunéré = intermédiation en assurance** (ORIAS + RC pro) | Élevé | Comparateur informatif non rémunéré jusqu'au lancement. Commission uniquement via ORIAS ou apport à un courtier immatriculé. Les 20-50€/switch ne sont pas mobilisables au MVP. |
| RGPD — contenu d'emails, parfois données sensibles | Élevé | Privacy by design dès S1 : brut supprimé après extraction (rétention 30j max), chiffrement au repos, sous-traitants documentés (Anthropic, Supabase, Cloudflare, Resend, Vercel), droit à l'effacement **implémenté**, jamais promis. |
| Extraction imprécise → confiance perdue au premier écran | Élevé | Éval dès S1. Score de confiance affiché. **Jamais d'action irréversible sur une donnée non confirmée par l'utilisateur.** |
| Vérification OAuth Google plus longue que prévu | Moyen | Dossier lancé S2, aucun lancement n'en dépend. |
| Coûts IA au scale | Faible | Cache + Batch API (‑50%) + dédup. À 30 000 users, le poste IA reste derrière l'hébergement. |

---

## 11. Conventions de code

Reprises du plan d'origine, corrigées.

- **Server Components par défaut** ; `"use client"` seulement pour l'interactivité.
- **Zod sur chaque input** d'API route.
- **`getUser()` en première ligne** de chaque route authentifiée.
- **Vérifier le quota** avant toute action limitée.
- Appels Claude en try/catch avec fallback ; le job repart en `failed` avec `attempts++`, jamais d'échec silencieux.
- **Structured outputs**, jamais de parsing de JSON depuis du texte libre.
- **Un email = une requête.** Le batching se fait via la Batch API Anthropic, pas en empilant des emails dans un prompt.
- Prompt caching sur le préfixe système ; vérifier `usage.cache_read_input_tokens` ≠ 0 en dev.
- Cache des classifications : même `content_hash` = pas de second appel.
- **Aucune donnée personnelle dans les logs** — ni contenu d'email, ni montant, ni adresse. Logger des ids.
- Server Actions pour les mutations de formulaire simples.
- Résultats IA toujours accompagnés de leur `confidence`, et l'UI l'affiche.

---

## 12. `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/process-jobs", "schedule": "0 6 * * *" },
    { "path": "/api/cron/send-alerts",  "schedule": "0 8 * * *" }
  ]
}
```

*(Le drain est déclenché par le Worker Cloudflare juste après chaque réception — latence quasi nulle, et compatible avec le plan Vercel Hobby qui limite les crons à un par jour. Le cron n'est qu'un rattrapage pour les jobs qu'un Worker en échec aurait laissés en file.)*

---

## 13. Hors périmètre avant lancement

Open Banking (DSP2), app mobile native, négociation automatique de factures, API white-label banques, espace famille partagé, envoi en recommandé AR24, pgvector.

Tous conditionnés à une seule chose : **que le taux d'activation du transfert mail tienne**. C'est testable en trois semaines, et rien ne mérite d'être construit avant cette réponse.
