"use client";

import { useState, type ReactNode } from "react";
import { buttonClasses, type ButtonVariant } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Eyebrow } from "./eyebrow";

/** Remise appliquée en facturation annuelle (−20 %). */
const ANNUAL_RATE = 0.8;

type Plan = {
  name: string;
  tagline: string;
  /** Prix mensuel HT, en euros. */
  monthly: number;
  scope: string;
  features: string[];
  cta: { label: string; variant: ButtonVariant };
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Essentiel",
    tagline: "Pour les églises qui s’organisent",
    monthly: 19,
    scope: "Jusqu’à 100 membres",
    features: [
      "Planning des services et équipes",
      "Indisponibilités et rappels",
      "Chants et grilles d’accords",
      "Projection des chants, salle et streaming",
      "Apps iOS et Android",
    ],
    cta: { label: "Demander mon accès", variant: "outline" },
  },
  {
    name: "Communauté",
    tagline: "Pour faire grandir toute l’église",
    monthly: 49,
    scope: "Jusqu’à 500 membres · tout Essentiel, plus :",
    features: [
      "Annonces et notifications push",
      "Événements et inscriptions en ligne",
      "Groupes de maison, suivi des nouveaux",
      "Dons en ligne et reçus fiscaux (bientôt)",
      "Administrateurs illimités",
    ],
    cta: { label: "Demander mon accès", variant: "accent" },
    featured: true,
  },
  {
    name: "Réseau",
    tagline: "Multi-sites, unions et fédérations",
    monthly: 119,
    scope: "Membres illimités · tout Communauté, plus :",
    features: [
      "Plusieurs sites et églises",
      "Tableau de bord consolidé",
      "Rôles et permissions avancés",
      "Migration des données offerte",
      "Accompagnement et formation dédiés",
    ],
    cta: { label: "Parler à l’équipe", variant: "dark" },
  },
];

const GUARANTEES = [
  { title: "Hébergé en France", text: "Données conformes au RGPD, chiffrées." },
  { title: "Support en français", text: "Une équipe qui connaît la vie d’église." },
  { title: "Sans engagement", text: "Résiliable à tout moment, SEPA ou virement." },
  { title: "Tarif solidaire", text: "Essentiel offert aux églises de moins de 30 membres." },
];

const amount = new Intl.NumberFormat("fr-FR");

export function Pricing() {
  const [annual, setAnnual] = useState(false);
  const price = (monthly: number) => (annual ? Math.round(monthly * ANNUAL_RATE) : monthly);

  return (
    <section id="tarifs" aria-labelledby="tarifs-title" className="bg-sand px-5 py-24 sm:px-7 lg:py-[140px]">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-12">
        <div data-reveal className="flex flex-col items-center gap-[18px] text-center">
          <Eyebrow>Tarifs</Eyebrow>
          <h2
            id="tarifs-title"
            className="max-w-[860px] font-display text-[clamp(42px,5vw,76px)] leading-[0.98] font-semibold"
          >
            Un abonnement. Tous les modules inclus.
          </h2>
          <p className="max-w-[620px] text-[18px] leading-[1.55] text-slate">
            Pas de facturation module par module, pas de dollars&nbsp;: un prix clair en euros, selon la
            taille de votre église.
          </p>
          <div
            role="group"
            aria-label="Période de facturation"
            className="flex gap-1 rounded-full border border-line bg-white p-[5px]"
          >
            <ToggleButton active={!annual} onClick={() => setAnnual(false)}>
              Mensuel
            </ToggleButton>
            <ToggleButton active={annual} onClick={() => setAnnual(true)}>
              Annuel
              <span className="rounded-full bg-coral px-2 py-0.5 text-[12px] text-white">−20&nbsp;%</span>
            </ToggleButton>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-[480px] items-stretch gap-5 lg:max-w-none lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div key={plan.name} data-reveal className="flex">
              <PlanCard
                plan={plan}
                price={price(plan.monthly)}
                note={
                  annual
                    ? `soit ${amount.format(price(plan.monthly) * 12)} € HT facturés par an`
                    : "Sans engagement, résiliable à tout moment"
                }
              />
            </div>
          ))}
        </div>

        <ul data-reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GUARANTEES.map((item) => (
            <li key={item.title} className="flex flex-col gap-1.5 rounded-[20px] bg-sand-light p-5">
              <span className="text-[15px] font-semibold">{item.title}</span>
              <span className="text-[14px] leading-[1.45] text-muted">{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "flex h-[42px] cursor-pointer items-center gap-2 rounded-full px-[22px] text-[15px] font-semibold transition-all duration-250",
        active ? "bg-dark text-white" : "bg-transparent text-dark",
      )}
    >
      {children}
    </button>
  );
}

function PlanCard({ plan, price, note }: { plan: Plan; price: number; note: string }) {
  const featured = plan.featured ?? false;
  return (
    <article
      className={cx(
        "relative flex w-full flex-col gap-[22px] rounded-[28px] p-8",
        featured
          ? "bg-ink text-sand shadow-[0_40px_80px_rgba(22,36,31,0.3)]"
          : "border border-line bg-white transition-[translate,box-shadow] duration-300 hover:-translate-y-1.5 hover:shadow-[0_30px_60px_rgba(22,36,31,0.12)]",
      )}
    >
      {featured && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-coral px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-white">
          Recommandé
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        <h3 className="font-display text-[34px] font-semibold">{plan.name}</h3>
        <p className={cx("text-[15px]", featured ? "text-mist-dark" : "text-muted")}>{plan.tagline}</p>
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className="text-[56px] font-bold tracking-[-0.03em]">{price}&nbsp;€</span>
        <span className={cx("text-[15px]", featured ? "text-mist-dark" : "text-muted")}>HT / mois</span>
      </p>
      <p className={cx("min-h-5 text-[14px] font-semibold", featured ? "text-teal-pale" : "text-teal-dark")}>
        {note}
      </p>
      <a
        href="#fondatrices"
        className={buttonClasses({ variant: plan.cta.variant, size: "lg", shape: "pill", fullWidth: true })}
      >
        {plan.cta.label}
      </a>
      <ul
        className={cx(
          "flex flex-col gap-3 border-t pt-5 text-[15px]",
          featured ? "border-moss" : "border-line-soft",
        )}
      >
        <li className="font-semibold">{plan.scope}</li>
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2.5">
            <span
              aria-hidden="true"
              className={cx("font-bold", featured ? "text-coral-light" : "text-teal-dark")}
            >
              ✓
            </span>
            {feature}
          </li>
        ))}
      </ul>
    </article>
  );
}
