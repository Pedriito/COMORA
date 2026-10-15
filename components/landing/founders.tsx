import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Eyebrow } from "./eyebrow";

const BENEFITS = [
  {
    title: "Gratuit jusqu’au lancement",
    text: "Toute l’équipe peut utiliser Comora sans frais jusqu’au 1er décembre.",
  },
  {
    title: "Installé avec vous",
    text: "Une demi-heure en visio pour créer vos équipes, vos services et inviter vos bénévoles.",
  },
  {
    title: "Votre tarif bloqué à vie",
    text: "12 € HT par mois pour Essentiel et 29 € HT pour Communauté, au lieu de 19 € et 49 €.",
  },
];

export function Founders() {
  return (
    <section
      id="fondatrices"
      aria-labelledby="fondatrices-title"
      className="bg-ink px-5 py-24 text-sand sm:px-7 lg:py-[140px]"
    >
      <div className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] items-start gap-16">
        <div data-reveal className="flex flex-col gap-6">
          <Eyebrow onDark>Accès anticipé</Eyebrow>
          <h2
            id="fondatrices-title"
            className="font-display text-[clamp(42px,5vw,72px)] leading-[0.98] font-semibold"
          >
            Devenez l’une des 20 églises fondatrices.
          </h2>
          <p className="max-w-[520px] text-[18px] leading-[1.6] text-pretty text-mist">
            Avant l’ouverture à toutes les églises le 1er décembre, nous accompagnons 20 églises de près. En
            échange, nous vous demandons simplement de nous dire ce qui marche et ce qui manque.
          </p>
          <BenefitList />
        </div>

        <div
          data-reveal
          className="flex flex-col gap-[18px] rounded-[28px] border border-moss-light bg-ink-card p-6 sm:p-9"
        >
          <h3 className="font-display text-[30px] leading-[1.1] font-semibold">Demander mon accès</h3>
          <p className="text-base leading-[1.6] text-mist">
            Quelques questions sur votre église (taille, équipes, organisation actuelle) pour réunir des
            églises fondatrices dont le quotidien ressemble au nôtre. Comptez trois minutes.
          </p>
          <Link
            href="/demande-acces"
            className={buttonClasses({ variant: "accent", size: "lg", shape: "pill", fullWidth: true, className: "mt-2" })}
          >
            Demander mon accès
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Les trois avantages des églises fondatrices (section d'accueil et page de demande). */
export function BenefitList() {
  return (
    <ul className="mt-2 flex flex-col gap-5">
      {BENEFITS.map((benefit) => (
        <li key={benefit.title} className="flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="flex size-7 flex-none items-center justify-center rounded-full bg-coral text-[13px] font-bold text-white"
          >
            ✓
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-[17px] font-semibold text-sand">{benefit.title}</span>
            <span className="text-base leading-[1.55] text-mist-dark">{benefit.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
