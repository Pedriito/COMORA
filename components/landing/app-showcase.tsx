import Image from "next/image";
import appImage from "@/assets/images/app-mobile.png";
import { Eyebrow } from "./eyebrow";
import { FloatCard, Parallax } from "./motion";

export function AppShowcase() {
  return (
    <section
      id="application"
      aria-labelledby="application-title"
      className="overflow-hidden bg-ink px-5 pt-[60px] pb-[120px] text-sand sm:px-7 lg:pb-[160px]"
    >
      <div className="mx-auto grid max-w-[1240px] items-center gap-16 lg:grid-cols-2">
        <div data-reveal className="flex flex-col gap-6">
          <Eyebrow onDark>Application mobile</Eyebrow>
          <h2
            id="application-title"
            className="font-display text-[clamp(42px,5vw,76px)] leading-[0.98] font-semibold"
          >
            Dans la poche de chaque bénévole.
          </h2>
          <p className="max-w-[500px] text-[18px] leading-[1.6] text-pretty text-mist">
            Gratuite pour tous vos membres. Ils voient quand ils servent, confirment en un geste,
            retrouvent les chants et les annonces de la semaine.
          </p>
          <p className="text-[15px] text-mist-dark">
            Sur iPhone, Android et ordinateur : elle s’installe depuis le navigateur, sans passer par les stores.
          </p>
        </div>

        <div className="relative flex h-[620px] justify-center sm:h-[720px]">
          <Parallax speed={-0.08} className="absolute top-0 w-[280px] sm:w-[340px]">
            <Image
              src={appImage}
              alt="Accueil de l’application Comora"
              sizes="(min-width: 640px) 340px, 280px"
              className="block h-auto w-full drop-shadow-[0_50px_80px_rgba(0,0,0,0.5)]"
            />
          </Parallax>
          <Parallax speed={-0.3} aria-hidden="true" className="absolute top-[180px] left-0">
            <FloatCard
              amplitude={10}
              phase={0.5}
              className="flex w-[210px] flex-col gap-1 rounded-[18px] bg-sand px-4 py-3.5 text-dark shadow-[0_24px_50px_rgba(0,0,0,0.35)]"
            >
              <span className="text-[12px] text-muted">Rappel · samedi 18h</span>
              <span className="text-[14px] font-semibold">Répétition demain à 8h30</span>
            </FloatCard>
          </Parallax>
          <Parallax speed={-0.2} aria-hidden="true" className="absolute right-0 bottom-[120px]">
            <FloatCard
              amplitude={12}
              phase={2.4}
              className="flex items-center gap-2.5 rounded-[18px] bg-coral px-4 py-3.5 text-[14px] font-semibold text-white shadow-[0_24px_50px_rgba(0,0,0,0.35)]"
            >
              ✓ Service confirmé
            </FloatCard>
          </Parallax>
        </div>
      </div>
    </section>
  );
}
