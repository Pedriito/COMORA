import Image from "next/image";
import louangeImage from "@/assets/images/louange-lumieres.jpg";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { Parallax } from "./motion";

export function FinalCta() {
  return (
    <section
      aria-labelledby="cta-title"
      className="relative overflow-hidden bg-ink px-5 py-[140px] text-sand sm:px-7 lg:py-[180px]"
    >
      <Parallax speed={0.25} className="absolute inset-x-0 -inset-y-[20%]">
        <Image src={louangeImage} alt="" fill sizes="100vw" className="object-cover opacity-30" />
      </Parallax>
      <div data-reveal className="relative mx-auto flex max-w-[900px] flex-col items-center gap-7 text-center">
        <Logo size={72} word="none" color="#efece3" />
        <h2 id="cta-title" className="font-display text-[clamp(46px,6vw,92px)] leading-[0.96] font-semibold">
          Rassemblez votre église dès dimanche.
        </h2>
        <p className="text-[18px] text-mist">
          20 places fondatrices avant l’ouverture à toutes les églises, le 1er décembre.
        </p>
        <a href="#fondatrices" className={buttonClasses({ variant: "accent", size: "lg", shape: "pill" })}>
          Demander mon accès
        </a>
      </div>
    </section>
  );
}
