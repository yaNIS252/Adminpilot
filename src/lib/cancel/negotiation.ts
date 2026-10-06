/**
 * Négocier avant de partir.
 *
 * Personne ne résilie plus par lettre, et la plupart des fournisseurs (box,
 * mobile, énergie, assurance) ont un service « fidélisation » qui accorde une
 * remise à qui montre qu'il est prêt à partir. Ce module prépare le message
 * qui le montre : ancienneté, prix payé, offre concurrente réelle tirée du
 * comparateur, et une demande claire.
 *
 * Sans IA : des modèles par catégorie, assemblés avec les données connues.
 * Rien d'inventé — sans offre concurrente vérifiée, le message n'en cite pas.
 *
 * Réservé aux contrats où un service fidélisation existe vraiment. Personne
 * n'obtient de geste commercial en écrivant à Spotify, Apple ou Netflix : là,
 * on résilie, c'est tout.
 */

type Family = "telecom" | "energie" | "assurance";

const FAMILIES: Record<string, Family> = {
  telecom: "telecom",
  energie: "energie",
  assurance: "assurance",
  sante: "assurance",
  banque: "assurance",
};

/** La carte « Négocier avant de partir » a-t-elle un sens pour cette catégorie ? */
export function isNegotiable(category: string | null): boolean {
  return Boolean(category && FAMILIES[category]);
}

export type NegotiationInput = {
  provider: string;
  category: string | null;
  /** Prix ramené au mois (comparaison), ou `null` s'il est inconnu. */
  monthly: number | null;
  /** Prix tel qu'il est facturé, lisible : « 69,90 € par an ». */
  priceLabel: string | null;
  /** Meilleure offre concurrente moins chère, issue du comparateur. */
  competitor: { provider: string; name: string; monthly: number } | null;
  /** Fin d'engagement à venir, si connue. */
  commitmentEnd: string | null;
  userName: string | null;
  /** Numéro du service client, quand le catalogue le connaît. */
  phone: string | null;
};

export type Negotiation = {
  subject: string;
  body: string;
  /** Conseils pour l'échange (téléphone, chat), du plus utile au moins utile. */
  tips: string[];
  /** Comment joindre le fournisseur. */
  contact: string[];
};

function euros(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} €`;
}

export function buildNegotiation(input: NegotiationInput): Negotiation | null {
  const family = input.category ? FAMILIES[input.category] : undefined;
  if (!family) return null;
  const lines: string[] = ["Bonjour,", ""];

  // L'ancienneté n'est pas citée : AdminPilot ne connaît que la date où il a
  // vu l'abonnement, pas celle de la souscription. L'utilisateur peut l'ajouter.
  lines.push(
    input.priceLabel
      ? `Je suis client chez vous et je paie ${input.priceLabel}.`
      : "Je suis client chez vous.",
  );

  if (input.competitor && input.monthly !== null) {
    const saving = (input.monthly - input.competitor.monthly) * 12;
    lines.push(
      `${input.competitor.provider} me propose « ${input.competitor.name} » à ${euros(input.competitor.monthly)} par mois, soit ${euros(saving)} d'économie sur un an.`,
    );
  } else {
    lines.push("En comparant, je trouve des offres équivalentes moins chères ailleurs.");
  }

  const ask: Record<Family, string> = {
    telecom:
      "Je préférerais rester chez vous, mais sans geste de votre part (baisse du prix de mon forfait, remise sur plusieurs mois ou options offertes), je demanderai mon code RIO pour partir avec mon numéro.",
    energie:
      "Je préférerais rester chez vous, mais sans proposition plus avantageuse sur mon tarif, je changerai de fournisseur : c'est gratuit et sans coupure.",
    assurance:
      "Je préférerais rester chez vous. Pouvez-vous revoir ma cotisation ? À défaut, je résilierai pour souscrire ailleurs.",
  };
  lines.push("", ask[family], "", "Merci de me faire une proposition.", "", "Cordialement,");
  if (input.userName) lines.push(input.userName);

  const tips: string[] = [];
  if (input.commitmentEnd) {
    tips.push(
      `Tu es engagé jusqu'au ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(`${input.commitmentEnd}T00:00:00Z`))} : résilier avant coûterait des frais. Négocier est ton meilleur levier d'ici là.`,
    );
  }
  const byFamily: Record<Family, string[]> = {
    telecom: [
      "Demande le service fidélisation (ou « résiliation ») : c'est lui qui a le droit d'accorder des remises.",
      "Compose le 3179 depuis ton mobile : tu reçois ton code RIO gratuitement. Le citer montre que tu es prêt à partir.",
      "N'accepte pas la première proposition : demande s'ils peuvent faire mieux, puis réfléchis avant de dire oui.",
    ],
    energie: [
      "Compare le prix du kWh et l'abonnement, pas seulement la mensualité.",
      "Changer de fournisseur ne coupe rien et ne coûte rien : le nouveau s'occupe de tout.",
    ],
    assurance: [
      "Après un an de contrat, la loi Hamon te permet de résilier à tout moment : rappelle-le.",
      "Demande une révision de ta cotisation avec un devis concurrent en main.",
    ],
  };
  tips.push(...byFamily[family]);
  tips.push("Note le nom de ton interlocuteur et garde une trace écrite de l'offre obtenue.");

  const where: Record<Family, string> = {
    telecom:
      "Sinon : ton espace client, rubrique Assistance ou Contact (chat, messagerie ou rappel gratuit). Demande le service fidélisation.",
    energie:
      "Le numéro de ton fournisseur figure en haut de ta facture ; tu peux aussi écrire depuis ton espace client, rubrique Contact.",
    assurance:
      "Le plus efficace : la messagerie de ton espace client ou ton conseiller (ses coordonnées sont sur ton contrat ou ton avis d'échéance).",
  };
  const contact = [
    ...(input.phone ? [`Par téléphone : ${input.phone} (gratuit depuis une ligne de l'opérateur).`] : []),
    where[family],
  ];

  return { contact, subject: `Mon abonnement ${input.provider} : avant de résilier`, body: lines.join("\n"), tips };
}
