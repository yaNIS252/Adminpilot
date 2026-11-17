/**
 * Domaines qui sont AUSSI des messageries grand public. Un filtre « tout ce
 * qui vient de orange.fr » transférerait les e-mails de chaque particulier
 * ayant une adresse @orange.fr — la grand-mère, le voisin — vers nos serveurs
 * et un modèle d'IA : des correspondances privées de tiers, sans rapport avec
 * le service (RGPD, minimisation). Pour eux, seules les adresses d'envoi
 * exactes du fournisseur sont retenues.
 */
export const CONSUMER_MAIL_DOMAINS = new Set([
  "orange.fr",
  "wanadoo.fr",
  "free.fr",
  "sfr.fr",
  "neuf.fr",
  "laposte.net",
  "bbox.fr",
  "numericable.fr",
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.fr",
  "hotmail.com",
  "hotmail.fr",
  "live.com",
  "live.fr",
  "msn.com",
  "yahoo.com",
  "yahoo.fr",
  "icloud.com",
  "me.com",
  "aol.com",
  "gmx.fr",
  "gmx.com",
  "proton.me",
  "protonmail.com",
]);


/**
 * Plateformes de paiement qui envoient les reçus AU NOM de leurs clients :
 * « Anthropic Ireland, Limited <invoice+statements+acct_…@stripe.com> ».
 * Leur domaine n'est pas celui du fournisseur : il ne sert ni de site du
 * fournisseur ni d'adresse d'envoi à apprendre. Le filtre Gmail les
 * transfère en entier (avec l'objet de facture exigé) : sinon Claude, et
 * tous les services facturés par Stripe ou Paddle, n'arrivaient jamais.
 */
export const BILLING_PLATFORM_DOMAINS = new Set(["stripe.com", "paddle.com"]);
