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
    q: "La lettre de résiliation est-elle vraiment valable ?",
    a: "Elle cite la base légale adaptée à ton contrat — loi Hamon, loi Chatel, résiliation infra-annuelle ou contrat sans engagement — et reprend les références extraites de tes factures.",
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
    <div className="flex flex-col gap-2.5">
      {QUESTIONS.map((item, index) => {
        const isOpen = open === index;

        return (
          <div
            key={item.q}
            className={`rounded-[14px] border transition-all ${
              isOpen
                ? "border-[rgba(139,124,240,.35)] bg-[rgba(139,124,240,.06)]"
                : "border-[var(--border)] bg-[rgba(255,255,255,.02)]"
            }`}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : index)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-5 py-[18px] text-left text-base font-medium text-[#f0f0f5]"
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
                <p className="m-0 px-5 pb-[18px] text-[15px] leading-[1.65] text-[var(--text-dim)]">
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
