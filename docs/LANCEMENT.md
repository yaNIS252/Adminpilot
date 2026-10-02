# Avant d'accepter de vrais clients

Liste à cocher. Rien ici n'est faisable à ta place : ce sont des démarches,
des contrats ou des achats à ton nom.

## Juridique

- [ ] **Statut** : micro-entreprise déclarée (activité de service, BNC ou BIC
      selon la qualification retenue avec l'URSSAF), SIREN obtenu.
- [ ] **Médiateur de la consommation** : adhérer à un médiateur agréé (obligatoire
      pour vendre à des particuliers, art. L612-1 du Code de la consommation).
      Liste officielle sur le site de la CECMC. Compter quelques dizaines
      d'euros par an.
- [ ] **Remplir `src/lib/legal.ts`** : nom, SIREN, adresse, e-mail, téléphone,
      directeur de publication, contact RGPD, médiateur. Les pages légales se
      complètent toutes seules, `/api/health` cesse de le signaler.
- [ ] **Relecture des CGU par un juriste**, en particulier le droit de
      rétractation (formulaire type à ajouter).
- [ ] **Assurance responsabilité civile professionnelle** (recommandée).

## Technique et comptes

- [ ] **Vercel Pro** (≈ 20 $/mois) : l'offre gratuite interdit l'usage
      commercial. Débloque aussi des tâches planifiées plus fréquentes.
- [ ] **Supabase Pro** (≈ 25 $/mois) : sauvegardes quotidiennes, pas de mise
      en veille du projet.
- [ ] **Nom de domaine** : l'acheter, le brancher sur Vercel, puis mettre à jour
      `NEXT_PUBLIC_SITE_URL`, l'URL du site dans Supabase (Authentication →
      URL Configuration), le webhook Stripe et le webhook de réception Resend.
- [ ] **Stripe en mode réel** : activer le compte (identité, IBAN), recréer les
      4 prix en mode réel, remplacer les clés et le secret du webhook sur Vercel.
- [ ] **Sentry** : créer le projet (région UE), ajouter `NEXT_PUBLIC_SENTRY_DSN`.
- [ ] **Anthropic** : plafond de dépense mensuel réglé, rechargement auto coupé.
- [ ] **Connexion Google** (facultatif) : client OAuth Google Cloud, activer le
      fournisseur dans Supabase, puis `NEXT_PUBLIC_GOOGLE_AUTH=1`.

## Contenu

- [ ] Vérifier les 11 guides de résiliation sur les vrais sites et dater
      `checked_at` dans `known_providers.cancel_guide`.
- [ ] Compléter le catalogue : adresses postales de résiliation, liens directs,
      bases légales (ex. Free Mobile noté « Loi Chatel » à revoir).
- [ ] Comparateur : saisir des offres vérifiées, ou signer avec des
      plateformes d'affiliation (énergie, télécom) avant d'y mettre des liens
      partenaires. Pas de lien rémunéré en assurance sans immatriculation ORIAS.

## Dernier contrôle

- [ ] Examen blanc (`docs/EXAMEN-BLANC.md`) entièrement au vert.
- [ ] `/api/health` → `ok: true`.
