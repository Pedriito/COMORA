import Image from "next/image";
import appImage from "@/assets/images/app-mobile.png";
import dashboardImage from "@/assets/images/tableau-de-bord.png";
import { Eyebrow } from "./eyebrow";

/**
 * Section collante : au fil du défilement (--p de 0 à 1), le titre s'efface
 * et le tableau de bord se redresse, puis l'application mobile glisse en place.
 */
export function FeatureStage() {
  return (
    <section
      id="fonctionnalites"
      aria-labelledby="fonctionnalites-title"
      data-scroll-stage
      className="relative h-[260vh] bg-sand"
    >
      <div className="sticky top-0 flex h-svh items-center justify-center overflow-hidden">
        <div
          className="absolute inset-x-0 top-[14vh] flex flex-col items-center gap-[18px] px-5 text-center sm:px-7"
          style={{
            opacity: "calc(1 - var(--p) * 1.8)",
            transform: "translateY(calc(var(--p) * -120px))",
          }}
        >
          <Eyebrow>Un seul espace</Eyebrow>
          <h2
            id="fonctionnalites-title"
            className="max-w-[980px] font-display text-[clamp(44px,6vw,88px)] leading-[0.98] font-semibold"
          >
            Tout votre ministère, enfin au même endroit.
          </h2>
          <p className="max-w-[560px] text-[18px] leading-normal text-slate">
            Fini les tableurs, les groupes WhatsApp et les rappels oubliés.
          </p>
        </div>

        <div className="relative w-[min(1120px,88vw)] perspective-[1800px]">
          <div
            className="origin-bottom"
            style={{
              transform:
                "translateY(calc((1 - var(--p)) * 46vh)) rotateX(calc((1 - var(--p)) * 26deg)) scale(calc(0.78 + var(--p) * 0.22))",
            }}
          >
            <Image
              src={dashboardImage}
              alt="Tableau de bord Comora"
              sizes="(min-width: 1280px) 1120px, 88vw"
              className="block h-auto w-full rounded-[14px] shadow-[0_60px_120px_rgba(22,36,31,0.35)]"
            />
          </div>
          <div
            className="absolute -right-[4%] -bottom-[8%] w-[22%]"
            style={{
              opacity: "clamp(0, calc(var(--p) * 3 - 1.6), 1)",
              transform:
                "translateX(calc(clamp(0, 1 - (var(--p) * 1.6 - 0.6), 1) * 220px)) rotate(calc(clamp(0, 1 - (var(--p) * 1.6 - 0.6), 1) * 8deg))",
            }}
          >
            <Image
              src={appImage}
              alt="Application mobile Comora"
              sizes="(min-width: 1280px) 250px, 20vw"
              className="block h-auto w-full drop-shadow-[0_40px_60px_rgba(22,36,31,0.4)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
