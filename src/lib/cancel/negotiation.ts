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
 */

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
};

export type Negotiation = {
  subject: string;
  body: string;
  /** Conseils pour l'échange (téléphone, chat), du plus utile au moins utile. */
  tips: string[];
};

function euros(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} €`;
}

type Family = "telecom" | "energie" | "assurance" | "numerique" | "autre";

function familyOf(category: string | null): Family {
  if (category === "telecom") return "telecom";
  if (category === "energie") return "energie";
  if (category === "assurance" || category === "sante" || category === "banque") return "assurance";
  if (["streaming", "logiciel", "presse", "sport"].includes(category ?? "")) return "numerique";
  return "autre";
}

export function buildNegotiation(input: NegotiationInput): Negotiation {
  const family = familyOf(input.category);
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
    numerique:
      "Je compte résilier à la fin de ma période en cours. Existe-t-il une offre pour rester (remise, formule moins chère, tarif annuel) ?",
    autre:
      "Je préférerais rester chez vous, mais sans geste commercial de votre part, je résilierai mon abonnement.",
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
    numerique: [
      "Commence la résiliation en ligne : beaucoup de services affichent une offre pour te retenir juste avant la dernière étape.",
      "Le tarif annuel revient souvent bien moins cher que le mensuel.",
    ],
    autre: ["Sois poli mais ferme : tu demandes un geste, sinon tu pars."],
  };
  tips.push(...byFamily[family]);
  tips.push("Note le nom de ton interlocuteur et garde une trace écrite de l'offre obtenue.");

  return { subject: `Mon abonnement ${input.provider} : avant de résilier`, body: lines.join("\n"), tips };
}
