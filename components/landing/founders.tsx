import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { appUrl } from "@/lib/site";
import { Eyebrow } from "./eyebrow";

const BENEFITS = [
  {
    title: "30 jours d’essai gratuit",
    text: "Toutes les fonctions de l’offre Communauté, sans carte bancaire. Rien n’est supprimé à la fin de l’essai.",
  },
  {
    title: "Prise en main guidée",
    text: "Une liste de premiers pas vous accompagne : importer vos membres, créer une équipe, planifier votre prochain culte.",
  },
  {
    title: "Votre tarif bloqué à vie",
    text: "12 € par mois pour Essentiel, 29 € pour Communauté et 69 € pour Signature, au lieu de 19 €, 49 € et 119 €, tant que l’abonnement n’est pas résilié.",
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
          <Eyebrow onDark>Offre fondateurs</Eyebrow>
          <h2
            id="fondatrices-title"
            className="font-display text-[clamp(42px,5vw,72px)] leading-[0.98] font-semibold"
          >
            Rejoignez les églises fondatrices.
          </h2>
          <p className="max-w-[520px] text-[18px] leading-[1.6] text-pretty text-mist">
            Les églises qui créent leur espace avant le 20 janvier 2027 gardent un tarif réduit à vie. En échange,
            nous vous demandons simplement de nous dire ce qui marche et ce qui manque.
          </p>
          <BenefitList />
        </div>

        <div
          data-reveal
          className="flex flex-col gap-[18px] rounded-[28px] border border-moss-light bg-ink-card p-6 sm:p-9"
        >
          <h3 className="font-display text-[30px] leading-[1.1] font-semibold">Créer l’espace de mon église</h3>
          <p className="text-base leading-[1.6] text-mist">
            Votre compte, puis quelques informations sur votre église (nom, ville, taille) : comptez trois minutes.
            Aucune carte bancaire n’est demandée.
          </p>
          <Link
            href={appUrl("/espace/inscription")}
            className={buttonClasses({ variant: "accent", size: "lg", shape: "pill", fullWidth: true, className: "mt-2" })}
          >
            Créer l’espace de mon église
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Les trois avantages des églises fondatrices. */
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
