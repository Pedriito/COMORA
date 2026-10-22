import Image from "next/image";
import heroImage from "@/assets/images/hero-louange.jpg";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { appUrl } from "@/lib/site";
import { FloatCard, Parallax } from "./motion";

export function Hero() {
  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="relative flex min-h-svh items-center overflow-hidden bg-ink text-sand"
    >
      <Parallax speed={0.35} className="absolute inset-x-0 -inset-y-[12%]">
        <Image
          src={heroImage}
          alt="Louange lors d’un culte"
          fill
          preload
          placeholder="blur"
          sizes="100vw"
          className="animate-ken-burns object-cover"
        />
      </Parallax>
      {/* Sur mobile le texte occupe toute la largeur : voile plus uniforme. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(22,36,31,0.6)_0%,rgba(22,36,31,0.82)_100%)] md:bg-[linear-gradient(90deg,rgba(22,36,31,0.9)_0%,rgba(22,36,31,0.6)_45%,rgba(22,36,31,0.18)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[30%] bg-[linear-gradient(180deg,rgba(22,36,31,0)_0%,#16241f_100%)]"
      />

      <HeroCards />

      <div data-hero-copy className="relative mx-auto w-full max-w-[1240px] px-5 pt-[140px] pb-[120px] sm:px-7">
        <div className="flex max-w-[min(720px,54%)] min-w-[min(100%,520px)] flex-col gap-7">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-teal-pale">
            Communiquer · Organiser · Rassembler
          </p>
          <h1
            id="hero-title"
            className="font-display text-[clamp(52px,8.4vw,124px)] leading-[0.92] font-semibold tracking-[-0.01em]"
          >
            <span className="block">Votre église,</span>
            <em className="block text-coral-light">rassemblée.</em>
          </h1>
          <p className="max-w-[560px] text-[clamp(17px,1.5vw,21px)] leading-[1.55] text-pretty text-[#d6dfdb]">
            La plateforme tout-en-un pensée pour les églises francophones&nbsp;: plannings des
            bénévoles, communication, chants et événements. Sur le web, iPhone et Android.
          </p>
          <div className="flex flex-wrap items-center gap-3.5">
            <Link
              href={appUrl("/espace/inscription")}
              className={buttonClasses({ variant: "accent", size: "lg", shape: "pill" })}
            >
              Créer l’espace de mon église
            </Link>
            <a
              href="#fonctionnalites"
              className="flex h-[52px] items-center gap-2.5 rounded-full border border-sand/40 px-6 text-base font-semibold text-sand transition-colors hover:bg-sand/10 hover:text-white"
            >
              Découvrir Comora <span aria-hidden="true">↓</span>
            </a>
          </div>
          <ul className="flex flex-wrap gap-x-[22px] gap-y-2 text-[14px] text-mist-dark">
            <li>30 jours d’essai gratuit, sans carte bancaire</li>
            <li>Offre fondateurs jusqu’au 20 janvier 2027</li>
            <li>Support en français</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Aperçus d'interface qui flottent à droite de la photo (grands écrans). */
function HeroCards() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[44%] min-[1100px]:block">
      <Parallax speed={-0.12} className="absolute top-[24%] right-[10%]">
        <FloatCard
          amplitude={10}
          phase={0}
          className="flex w-[280px] items-center gap-3 rounded-[18px] bg-white/96 px-4 py-3.5 text-dark shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
        >
          <span className="flex size-10 flex-none items-center justify-center rounded-full bg-teal-dark text-[13px] font-bold text-white">
            LM
          </span>
          <span className="flex flex-col gap-[3px]">
            <span className="text-[14px] font-semibold">Léa a confirmé sa présence</span>
            <span className="text-[12px] text-muted">Louange · dimanche 10h</span>
          </span>
        </FloatCard>
      </Parallax>

      <Parallax speed={-0.22} className="absolute right-[22%] bottom-[20%]">
        <FloatCard
          amplitude={14}
          phase={1.6}
          className="flex w-[240px] flex-col gap-2 rounded-[18px] border border-moss bg-ink-light p-4 shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-pale">
            Culte de dimanche
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-moss">
            <span className="block h-full w-[86%] bg-coral" />
          </span>
          <span className="text-[13px] text-mist">18 bénévoles sur 21 confirmés</span>
        </FloatCard>
      </Parallax>

      <Parallax speed={-0.06} className="absolute top-[54%] left-[6%]">
        <FloatCard
          amplitude={8}
          phase={3.1}
          className="flex items-center gap-2.5 whitespace-nowrap rounded-full bg-coral py-2.5 pr-4 pl-3 text-[13px] font-semibold text-white shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          Nouveau chant&nbsp;: «&nbsp;Ensemble&nbsp;» en La
        </FloatCard>
      </Parallax>
    </div>
  );
}
