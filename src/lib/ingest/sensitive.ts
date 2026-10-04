/**
 * E-mails de sécurité : codes de connexion, alertes de nouvel appareil,
 * réinitialisations de mot de passe.
 *
 * Ils peuvent arriver malgré l'exclusion du filtre Gmail : transfert manuel,
 * règle Outlook, filtre importé avant cette exclusion. Ils ne servent à rien
 * pour suivre des abonnements et donnent de quoi entrer dans un compte : on
 * les refuse à la réception, sans les stocker ni les faire lire par l'IA.
 */
const SECURITY_SUBJECT =
  /\b(code|mot de passe|nouvel appareil|nouvelle connexion|tentative de connexion|v[ée]rification|s[ée]curit[ée]|security|password|sign[- ]?in|log[- ]?in|otp|authentification|2fa)\b/i;

export function isSecurityEmail(subject: string): boolean {
  // « Votre facture » l'emporte : une facture dont l'objet cite un « code
  // client » reste une facture.
  if (/\b(facture|re[çc]u|invoice|receipt|pr[ée]l[èe]vement)\b/i.test(subject)) return false;
  return SECURITY_SUBJECT.test(subject);
}
