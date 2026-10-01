-- Guides de résiliation pas à pas, par fournisseur.
--
-- Forme : { "steps": [texte, …], "note": texte | null, "checked_at": date | null }
-- `checked_at` reste null tant que le parcours n'a pas été refait à la main
-- sur le site : l'interface affiche alors le guide comme « indicatif ». Les
-- menus des sites changent souvent ; un guide faux coûte plus cher en
-- confiance qu'une absence de guide.

alter table known_providers add column cancel_guide jsonb;

update known_providers set cancel_guide = $${
  "steps": ["Connecte-toi sur netflix.com depuis un navigateur.", "Ouvre Compte, puis la rubrique Abonnement.", "Clique sur Annuler l'abonnement, puis confirme avec Terminer l'annulation."],
  "note": "Tu gardes l'accès jusqu'à la fin de la période déjà payée. Si tu paies via l'App Store ou Google Play, la résiliation se fait depuis les réglages du téléphone.",
  "checked_at": null
}$$::jsonb where name = 'Netflix';

update known_providers set cancel_guide = $${
  "steps": ["Connecte-toi sur spotify.com (le site, pas l'application).", "Ouvre ton compte, puis Gérer votre abonnement.", "Choisis Annuler Premium et confirme."],
  "note": "Ton compte repasse en version gratuite à la fin de la période payée ; tes playlists sont conservées.",
  "checked_at": null
}$$::jsonb where name = 'Spotify';

update known_providers set cancel_guide = $${
  "steps": ["Connecte-toi sur disneyplus.com depuis un navigateur.", "Clique sur ton profil, puis Compte.", "Sous Abonnement, choisis l'abonnement puis Résilier l'abonnement."],
  "note": "Si tu as souscrit via un opérateur (box, mobile) ou un store d'application, c'est auprès de lui qu'il faut résilier.",
  "checked_at": null
}$$::jsonb where name = 'Disney+';

update known_providers set cancel_guide = $${
  "steps": ["Connecte-toi sur deezer.com.", "Ouvre Paramètres du compte, puis Mon abonnement.", "Clique sur Résilier mon abonnement et confirme."],
  "note": null,
  "checked_at": null
}$$::jsonb where name = 'Deezer';

update known_providers set cancel_guide = $${
  "steps": ["Ouvre youtube.com/paid_memberships en étant connecté.", "Clique sur Gérer l'abonnement à côté de YouTube Premium.", "Choisis Désactiver, puis confirme la résiliation."],
  "note": "Sur iPhone, si l'abonnement a été pris dans l'application, il se résilie dans les réglages de l'App Store.",
  "checked_at": null
}$$::jsonb where name = 'YouTube Premium';

update known_providers set cancel_guide = $${
  "steps": ["Sur amazon.fr, ouvre Compte et listes, puis Votre abonnement Prime.", "Clique sur Gérer l'abonnement, puis Mettre fin à l'abonnement.", "Amazon propose plusieurs offres pour te retenir : continue jusqu'à la confirmation finale."],
  "note": "Si tu n'as utilisé aucun avantage Prime depuis le dernier paiement, tu peux demander un remboursement.",
  "checked_at": null
}$$::jsonb where name in ('Amazon Prime', 'Prime Video');

update known_providers set cancel_guide = $${
  "steps": ["Sur iPhone ou iPad : Réglages, puis ton nom en haut de l'écran.", "Ouvre Abonnements et choisis l'abonnement concerné.", "Touche Annuler l'abonnement et confirme."],
  "note": "Sur Mac : App Store, ton nom, Réglages du compte, Abonnements. Sur le web : account.apple.com.",
  "checked_at": null
}$$::jsonb where name in ('Apple TV+', 'iCloud');

update known_providers set cancel_guide = $${
  "steps": ["Connecte-toi sur account.microsoft.com.", "Ouvre Services et abonnements.", "À côté de Microsoft 365, choisis Gérer puis Annuler l'abonnement."],
  "note": "Désactiver le renouvellement automatique suffit : l'abonnement reste actif jusqu'à son terme.",
  "checked_at": null
}$$::jsonb where name = 'Microsoft 365';

update known_providers set cancel_guide = $${
  "steps": ["Connecte-toi sur account.adobe.com.", "Ouvre Formules et paiement, puis Gérer la formule.", "Choisis Annuler votre formule et suis les étapes jusqu'à la confirmation."],
  "note": "Attention : une formule annuelle payée chaque mois entraîne des frais si tu résilies avant son terme. Les 14 jours qui suivent la souscription sont gratuits.",
  "checked_at": null
}$$::jsonb where name = 'Adobe';
