# Examen blanc — AdminPilot comme un vrai client

But : dérouler **tout** le parcours d'un client réel, sur le site en ligne
(`adminpilot-ashen.vercel.app`), avec de vraies adresses e-mail et de vraies
factures. Toi, tu fais les gestes du client. Moi, je vérifie à chaque étape ce
qui se passe en base, dans les journaux et dans `/api/health`.

Légende : **Toi** = action côté client · **Moi** = contrôle technique ·
✅ attendu.

---

## 0. Prérequis (bloquants)

| # | Quoi | Qui | Comment vérifier |
|---|---|---|---|
| 0.1 | Clé `MISTRAL_API_KEY` sur Vercel + redéploiement | ✅ fait | Moi : `/api/health` → `ai: true`, `ai_provider: mistral` |
| 0.2 | SMTP personnalisé dans Supabase (Resend, `connexion@`) | ✅ fait | E-mail de connexion reçu en français |
| 0.3 | Webhook de réception Resend → `adminpilot-ashen.vercel.app/api/inbound` | ✅ fait | Moi : `last_email_received_at` change au premier transfert |
| 0.4 | Portail client Stripe activé, produit renommé « Premium » | ✅ fait (toi) | Moi : bouton « Gérer mon abonnement » ouvre le portail |
| 0.5 | Deux adresses Gmail de test neuves (A = client, B = proche) | Toi | — |

---

## 1. Inscription et connexion

| # | Toi | ✅ Attendu | Moi |
|---|---|---|---|
| 1.1 | Page d'accueil → « Commencer gratuitement » | Arrivée sur la création de compte | — |
| 1.2 | Créer un compte avec A **sans** cocher les CGU | Bouton refusé, message clair | — |
| 1.3 | Cocher les CGU, envoyer | « Lien envoyé », bouton « Ouvrir Gmail » | Journal Resend : e-mail parti |
| 1.4 | Ouvrir le lien **dans le même navigateur** | Arrivée sur l'onboarding | Profil créé, plan `free` |
| 1.5 | Redemander un lien deux fois de suite | Message « réessaie dans N secondes » | — |
| 1.6 | Ouvrir un vieux lien déjà utilisé | Message « lien expiré », pas d'écran blanc | — |
| 1.7 | Onglet « J'ai un compte » avec une adresse inconnue | Pas de compte créé en douce | Aucun profil créé |

## 2. Onboarding et transfert automatique

| # | Toi | ✅ Attendu | Moi |
|---|---|---|---|
| 2.1 | Copier l'adresse `u-…@in.zylax.fr` | Bouton « Copié » | — |
| 2.2 | Gmail → Transfert → ajouter l'adresse | Le **code Gmail s'affiche tout seul** dans l'onboarding | Webhook reçu, code enregistré |
| 2.3 | Valider le code chez Google | Transfert accepté | — |
| 2.4 | Télécharger et importer le filtre Gmail (cases cochées) | Filtres créés dans Gmail | — |
| 2.5 | « C'est fait » | Tableau de bord, bannière « Passe Pro » | `gmail_forward_verified = true` |

## 3. Réception et détection

| # | Toi | ✅ Attendu | Moi |
|---|---|---|---|
| 3.1 | Transférer une vraie facture Netflix (ou Spotify…) | Abonnement détecté, montant, cycle, échéance | Tâche `done`, modèle utilisé, coût |
| 3.2 | Transférer une facture EDF avec PDF joint | Abonnement + document classé et renommé | Document indexé, recherche possible |
| 3.3 | Transférer une newsletter | Rien de créé | Tâche `done`, type `skip` |
| 3.4 | Retransférer exactement le même e-mail | Pas de doublon | Contrainte d'unicité respectée |
| 3.5 | Transférer une 2ᵉ facture du même fournisseur | Toujours **un** abonnement | Rapprochement fait |
| 3.6 | Déposer une photo de facture (page Documents) | Document ajouté puis classé | — |
| 3.7 | Déposer un faux PDF (fichier texte renommé) | Refus clair | 415 |
| 3.8 | Corriger un montant, confirmer une détection douteuse | Valeur gardée, plus « à vérifier » | Une facture suivante n'écrase pas la correction |
| 3.9 | Supprimer un abonnement | Disparaît, total mis à jour | Rappels supprimés |

## 4. Limites de la formule gratuite

| # | Toi | ✅ Attendu |
|---|---|---|
| 4.1 | Transférer des factures de 6 fournisseurs différents | 5 visibles + encart « 1 autre abonnement détecté » |
| 4.2 | Déposer 11 documents | Le 11ᵉ refusé, encart Pro |
| 4.3 | Page Alertes | Compteur x / 3, cadenas « Illimité avec Pro » |
| 4.4 | Page Documents | Barre de recherche verrouillée |
| 4.5 | Page Résilier | Lien en ligne visible, négociation verrouillée |
| 4.6 | Changer le thème | 2 fonds et 2 couleurs, le reste verrouillé |
| 4.7 | Fermer la bannière « Passe Pro » puis recharger | Elle reste fermée |

## 5. Paiement (mode test Stripe)

Cartes : `4242 4242 4242 4242` (OK) · `4000 0000 0000 0002` (refusée) ·
`4000 0025 0000 3155` (validation 3-D Secure). Date future, CVC quelconque.

| # | Toi | ✅ Attendu | Moi |
|---|---|---|---|
| 5.1 | Réglages → Pro mensuel → payer avec la carte refusée | Refus affiché par Stripe, rien débité | Plan toujours `free` |
| 5.2 | Payer avec 4242 | Retour « Bienvenue en Pro », abonnement masqué débloqué | Webhook reçu, plan `pro`, alertes programmées |
| 5.2b | Page Abonnements | Ligne « AdminPilot Pro » 5,99 €/mois avec la prochaine échéance, bouton « Géré dans Réglages » | Ligne `source: adminpilot_billing`, rappels programmés |
| 5.3 | Facture Stripe | Mention « TVA non applicable, art. 293 B du CGI » | — |
| 5.4 | Changer pour Premium annuel | Différence facturée au prorata, plan Premium | Plan `family` |
| 5.5 | Revenir en Pro mensuel | Crédit sur la prochaine facture | — |
| 5.6 | « Gérer mon abonnement » | Portail Stripe : carte, factures, résiliation | — |
| 5.7 | « Résilier mon abonnement » dans les réglages | Écran de résiliation Stripe, bandeau « résiliation enregistrée », **e-mail de confirmation reçu** | Plus de prochaine échéance sur la ligne AdminPilot |
| 5.8 | Payer sans cocher la case de rétractation | Bouton « Payer » inactif | API : 400 |

## 6. Premium et foyer (avec l'adresse B)

| # | Toi | ✅ Attendu | Moi |
|---|---|---|---|
| 6.1 | En Premium, inviter B | E-mail d'invitation reçu par B + lien à copier | Jeton stocké en empreinte seulement |
| 6.2 | B ouvre le lien, crée son compte, rejoint | B passe en Premium, bandeau « Bienvenue dans le foyer » | Plan de B = `family` |
| 6.3 | B regarde son tableau de bord | **Aucune** donnée de A visible | RLS : 0 ligne de A |
| 6.4 | Réutiliser le même lien | « Invitation indisponible » | — |
| 6.5 | A repasse en Pro | B repasse en gratuit, avertissement affiché avant | Plan de B = `free` |
| 6.6 | B quitte le foyer / A retire B | Cohérent des deux côtés | — |

## 6b. Parrainage (A parraine une adresse C neuve)

| # | Toi | ✅ Attendu | Moi |
|---|---|---|---|
| 6b.1 | A : Réglages → Parrainage → « Copier le lien » | Lien `/p/…`, compteur 0 / 12 | — |
| 6b.2 | Navigateur privé : ouvrir le lien | Onglet « Créer un compte » + encart « Un proche t’offre 1 mois de Pro » | Cookie `ap_ref` posé |
| 6b.3 | C crée son compte | Chez A : C « inscrit » | Ligne `referrals` en `signed_up` |
| 6b.4 | C ajoute son adresse dans Gmail (code reçu) | C passe en Pro, « Offerte par parrainage jusqu’au … » | `pending`, empreinte de la boîte enregistrée |
| 6b.5 | C transfère 2 factures | Chez A : « en attente de validation » | — |
| 6b.6 | — | — | Je vieillis le compte de C de 8 jours et lance la tâche du jour → A « validé », e-mail reçu, A en Pro (ou crédit Stripe s’il paie) |
| 6b.7 | C clique « Payer » pendant son mois offert | Stripe affiche un essai jusqu’à la fin du mois offert, carte demandée | Abonnement `trialing`, date effacée du profil |
| 6b.8 | A se parraine avec `a+1@gmail.com` | Rien d’offert, « en attente » chez A | `blocked:self_email` |
| 6b.9 | Tableau de bord de A | Carte « Tu paies X € par mois… Et tes proches ? », fermable | — |

## 7. Alertes et hausses de prix

| # | Toi | ✅ Attendu | Moi |
|---|---|---|---|
| 7.1 | Page Alertes : couper un rappel, créer un rappel manuel pour aujourd'hui | Rappel listé | — |
| 7.2 | — | — | Je lance l'envoi du jour → **e-mail reçu** (échéance + rappel manuel) |
| 7.3 | Couper les rappels d'un abonnement | Ses rappels disparaissent | — |
| 7.4 | Transférer une facture plus chère du même fournisseur | Alerte « X augmente », pastille ↑, bloc « Évolution des prix » | `price_changes` + alerte |
| 7.5 | Transférer un e-mail d'annonce de hausse | Alerte avant la hausse, prix actuel inchangé | Source `announcement` |

## 8. Résiliation

| # | Toi | ✅ Attendu | Moi |
|---|---|---|---|
| 8.1 | Abonnement → « Résilier » | Lien officiel, guide pas à pas, astuce de la catégorie | — |
| 8.2 | « Négocier avant de partir » (Pro), sur une box, un mobile, une assurance, l'énergie ou la banque | Message prêt, prix réel, offre concurrente citée si le comparateur en a une, conseils, « Comment les joindre » (numéro pour Orange, SFR, Bouygues, Free) ; « Copier » et « Ouvrir mon espace client » marchent. Sur un streaming ou un logiciel : pas de carte « Négocier » | — |
| 8.3 | « J'ai résilié » | Abonnement dans « Résiliés », hors total | Rappels supprimés |
| 8.4 | Transférer un vrai e-mail de confirmation de résiliation | Passage automatique en « Résiliés » | `cancelled_via: email` |
| 8.5 | « Reprendre le suivi » | Revient dans les actifs, rappels recréés | — |

## 9. Recherche, profil, thème

| # | Toi | ✅ Attendu |
|---|---|---|
| 9.1 | Rechercher « facture EDF », « mes factures », un mois, un montant | Bons documents, « compris : … » affiché |
| 9.2 | Photo de profil, prénom | Visibles dans la barre latérale |
| 9.3 | Changer le thème (aperçu, annuler, appliquer) | Appliqué partout, gardé au rechargement |

## 10. RGPD et compte

| # | Toi | ✅ Attendu | Moi |
|---|---|---|---|
| 10.1 | Exporter mes données | Fichier complet, liens de téléchargement valides 24 h | — |
| 10.2 | Supprimer le compte B (en retapant l'adresse) | Déconnecté, compte effacé | Fichiers supprimés, abonnement Stripe annulé |

## 11. Parcours téléphone

Sur ton téléphone, dans Chrome ou Safari, avec un compte de test neuf (D) si
possible. Partout : rien ne déborde sur le côté, tout se lit sans zoomer, les
boutons s'atteignent au pouce.

| # | Toi | ✅ Attendu |
|---|---|---|
| 11.1 | Inscription avec un lien magique, ouvert depuis l'app Gmail du téléphone | Connecté directement, la présentation de bienvenue s'affiche en entier |
| 11.2 | Présentation : étape « boîte mail » | Explications « téléphone » : Gmail en version pour ordinateur, 3 champs à copier ; chaque « Copier » marche |
| 11.3 | Créer le filtre dans Gmail (version ordinateur) en collant les champs | Filtre créé, transfert vers l'adresse AdminPilot confirmé |
| 11.4 | Transférer une facture depuis l'app Gmail | Abonnement visible dans les minutes qui suivent |
| 11.5 | Barre du bas : passer par chaque onglet | Toutes les pages s'ouvrent, l'onglet actif est visible |
| 11.6 | Ajouter un abonnement à la main | Formulaire utilisable, clavier qui ne cache pas le bouton |
| 11.7 | Documents → prendre une facture en photo | Photo envoyée, document rangé |
| 11.8 | Abonnement → Résilier → Négocier → « Envoyer par e-mail » | L'app de messagerie s'ouvre avec le message rempli |
| 11.9 | Réglages → parrainage → « Partager » / WhatsApp / SMS | Le menu de partage du téléphone, WhatsApp ou les SMS s'ouvrent avec le lien |
| 11.10 | Ajouter à l'écran d'accueil | Icône AdminPilot, l'app s'ouvre sans barre d'adresse |
| 11.11 | Thème clair / sombre du téléphone | Lisible dans les deux |

## 12. Contrôles techniques (moi)

- Accès croisés : ouvrir les identifiants (abonnement, document) d'un
  autre compte → 404 partout.
- Écritures directes Supabase avec la clé publique → refusées.
- `/api/health` → `ok: true` hormis les mentions légales.
- Erreur volontaire → remontée dans Sentry (si le DSN est configuré).
- Coût IA réel de l'examen relevé dans la console Anthropic.

---

**Critère de réussite** : toutes les lignes ✅, aucune erreur non expliquée dans
les journaux, et un coût IA cohérent avec l'estimation (≈ 0,15 € par
utilisateur actif et par mois).
