"use client";

import { useId, useState } from "react";
import { cx } from "@/components/ui/cx";

const QUESTIONS = [
  {
    question: "Qu’est-ce qu’une église fondatrice ?",
    answer:
      "Les églises qui créent leur espace avant le 20 janvier 2027 gardent à vie un tarif réduit, tant que leur abonnement n’est pas résilié : 12 € par mois pour Essentiel, 29 € pour Communauté et 69 € pour Signature. En échange, nous leur demandons simplement leurs retours.",
  },
  {
    question: "Puis-je importer les données de mon église ?",
    answer:
      "Oui. Importez vos membres et vos chants depuis un fichier Excel ou CSV en quelques minutes. La migration est assistée pour toutes les offres, et accompagnée avec l’offre Signature.",
  },
  {
    question: "Où sont hébergées nos données ?",
    answer:
      "En France, chez un hébergeur certifié, avec chiffrement et sauvegardes quotidiennes. Comora est conforme au RGPD et vous restez propriétaire de vos données.",
  },
  {
    question: "Les membres et bénévoles doivent-ils payer ?",
    answer:
      "Non. L’application, sur téléphone comme sur ordinateur, est gratuite pour tous vos membres. Seule l’église souscrit un abonnement, selon sa taille.",
  },
  {
    question: "Combien de temps puis-je essayer Comora ?",
    answer:
      "30 jours, gratuitement et sans carte bancaire, avec toutes les fonctions de l’offre Communauté. À la fin de l’essai, si vous ne choisissez pas d’offre, votre espace passe en lecture seule : rien n’est supprimé et vous pouvez vous abonner quand vous le souhaitez.",
  },
  {
    question: "Puis-je changer d’offre en cours de route ?",
    answer:
      "Vous pouvez passer à une offre supérieure à tout moment : le changement est immédiat et calculé au prorata, sans frais. En mensuel, vous pouvez aussi descendre d’offre à tout moment ; en annuel, à l’échéance des 12 mois.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-sand-light px-5 py-24 sm:px-7 lg:py-[120px]">
      <div className="mx-auto flex max-w-[860px] flex-col gap-8">
        <h2
          id="faq-title"
          data-reveal
          className="text-center font-display text-[clamp(40px,4.6vw,64px)] leading-none font-semibold"
        >
          Vos questions
        </h2>
        <div className="flex flex-col overflow-hidden rounded-3xl border border-line bg-white">
          {QUESTIONS.map((item, index) => {
            const expanded = open === index;
            const buttonId = `${baseId}-q${index}`;
            const panelId = `${baseId}-r${index}`;
            return (
              <div key={item.question} className="border-b border-line-soft last:border-b-0">
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpen(expanded ? null : index)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-[22px] text-left text-[17px] font-semibold text-dark sm:px-[26px]"
                  >
                    {item.question}
                    <span
                      aria-hidden="true"
                      className={cx(
                        "flex size-8 flex-none items-center justify-center rounded-full bg-teal-50 text-[20px] text-teal-dark transition-transform duration-300",
                        expanded && "rotate-45",
                      )}
                    >
                      +
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  inert={!expanded}
                  className={cx(
                    "grid transition-[grid-template-rows] duration-350 ease-out",
                    expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-6 text-base leading-[1.6] text-slate sm:px-[26px]">{item.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
