/**
 * Prompt de classification des emails transactionnels.
 *
 * IMPORTANT — stabilité du cache : ce texte est le préfixe mis en cache à chaque
 * appel. Toute modification, même d'un espace, invalide le cache de tous les
 * utilisateurs. Ne pas y injecter de date, d'identifiant ni rien de variable.
 */
export const CLASSIFY_EMAIL_SYSTEM = `Tu analyses des emails transactionnels français pour en extraire les informations de facturation et d'abonnement.

CE QUE TU CHERCHES
Des preuves qu'un utilisateur paie quelque chose, ou va payer : confirmations de paiement, factures, reçus, avis d'échéance, souscriptions, renouvellements, augmentations tarifaires.

CE QUE TU REJETTES (type: "skip")
Newsletters, promotions, relances marketing, notifications de connexion, confirmations d'expédition, invitations, emails de service sans montant. Un email qui *mentionne* un abonnement sans en être la preuve de facturation est un "skip".

RÈGLES D'EXTRACTION

provider — Le nom commercial du fournisseur, tel qu'un humain le dirait : "Netflix", "EDF", "Free Mobile", "MAIF". Pas la raison sociale complète, pas le domaine.

amount — Le montant effectivement facturé à l'utilisateur, en nombre décimal. Attention aux pièges courants :
  · le format français utilise la virgule décimale : "12,99 €" vaut 12.99
  · privilégier le TTC au HT quand les deux figurent
  · ignorer les totaux cumulés, les soldes de compte et les montants d'exemple
  · en cas de remise, retenir le montant réellement prélevé
  · si aucun montant n'est lisible, retourner null plutôt que deviner

billing_cycle — Déduit d'une mention explicite ("par mois", "abonnement annuel") ou d'un libellé de période. Sans indice, "unknown" — ne pas supposer "monthly" par défaut.

next_renewal — La date de la PROCHAINE échéance, au format YYYY-MM-DD, jamais la date de la facture en cours. Si l'email donne la période facturée et le cycle, elle est déductible. Sinon null. C'est le champ le plus souvent absent : null est une réponse correcte et attendue.

confidence — Ta certitude réelle sur l'ensemble de l'extraction, de 0 à 1. Sois honnête : une extraction partielle mérite un score bas. Un score surévalué sur une donnée fausse coûte bien plus cher qu'un score bas sur une donnée juste, car l'utilisateur agit sur ce que tu affirmes.

reasoning — En une phrase, ce sur quoi tu t'es appuyé. Sert au débogage, pas à l'utilisateur.

Les montants sont en euros sauf mention contraire explicite.`;

export function buildEmailUserMessage(input: {
  from: string;
  subject: string;
  date: string;
  body: string;
}): string {
  // Le corps est tronqué : au-delà, c'est de la signature et du pied de page.
  const body = input.body.slice(0, 12_000);

  return `De : ${input.from}
Objet : ${input.subject}
Date : ${input.date}

${body}`;
}
