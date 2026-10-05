"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

/**
 * Questions fréquentes.
 *
 * Les réponses reflètent le comportement réel du produit — notamment le fait
 * qu'une détection peu sûre soit marquée « à vérifier » plutôt que présentée
 * comme acquise. Promettre ici autre chose que ce que fait le code serait la
 * meilleure façon de décevoir au premier écran.
 *
 * L'ouverture se fait par `grid-template-rows: 0fr → 1fr`, ce qui permet
 * d'animer vers une hauteur inconnue à l'avance, impossible avec `height`.
 *
 * Présentées en liste séparée de filets, et non en boîtes arrondies empilées :
 * c'est plus calme, et l'œil suit une colonne de questions plutôt qu'une pile
 * de cartes.
 */

const QUESTIONS = [
  {
    q: "AdminPilot lit-il toute ma boîte mail ?",
    a: "Non. AdminPilot ne se connecte jamais à ta boîte : il ne voit que les emails que tu lui transfères, manuellement ou via une règle de transfert Gmail que tu contrôles.",
  },
  {
    q: "Comment les abonnements sont-ils détectés ?",
    a: "Chaque email transféré est analysé : fournisseur, montant, périodicité et prochaine échéance sont extraits. Quand la confiance est faible, la détection est marquée « à vérifier » plutôt que présentée comme un fait.",
  },
  {
    q: "Comment AdminPilot m'aide-t-il à payer moins cher ?",
    a: "Il t'alerte avant chaque reconduction et à chaque hausse de prix, te montre le lien pour résilier en ligne et, avec Pro, prépare un message de négociation appuyé sur une offre concurrente : les fournisseurs accordent souvent une remise à qui montre qu'il est prêt à partir.",
  },
  {
    q: "Que deviennent mes données ?",
    a: "Les messages bruts sont supprimés trente jours après analyse. Seules les données extraites sont conservées, et rien ne sert à entraîner un modèle. Tu peux exporter ou supprimer ton compte à tout moment.",
  },
  {
    q: "Puis-je changer de plan ?",
    a: "Oui, à tout moment depuis les réglages. Le plan Gratuit reste disponible sans limite de durée.",
  },
] as const;

export function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <div className="border-t border-[var(--border)]">
      {QUESTIONS.map((item, index) => {
        const isOpen = open === index;

        return (
          <div key={item.q} className="border-b border-[var(--border)]">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : index)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-4 py-5 text-left text-[17px] font-medium text-[var(--text-bright)]"
            >
              <span className="flex-1">{item.q}</span>
              <Plus
                className={`size-[18px] shrink-0 transition-transform ${
                  isOpen
                    ? "rotate-45 text-[var(--accent-light)]"
                    : "text-[var(--text-faint)]"
                }`}
              />
            </button>

            <div
              className="grid transition-[grid-template-rows] duration-300"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="m-0 max-w-[620px] pr-10 pb-6 text-[15px] leading-[1.7] text-pretty text-[var(--text-dim)]">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
