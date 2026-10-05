import Image from "next/image";
import laRencontreLogo from "@/assets/images/eglise-la-rencontre.png";

export function Origin() {
  return (
    <section className="bg-white px-5 py-24 sm:px-7 lg:py-[140px]">
      <div data-reveal className="mx-auto flex max-w-[900px] flex-col items-center gap-6 text-center">
        <Image
          src={laRencontreLogo}
          alt="Église La Rencontre"
          width={64}
          height={64}
          className="size-16 rounded-[18px]"
        />
        <p className="font-display text-[clamp(30px,3.4vw,46px)] leading-[1.2] font-medium text-pretty">
          Comora est né à l’Église La Rencontre, pour que ses bénévoles passent moins de temps à
          s’organiser et plus de temps à servir. Aujourd’hui, nous l’ouvrons à toutes les églises
          francophones.
        </p>
        <p className="text-[14px] font-semibold uppercase tracking-[0.12em] text-teal-dark">
          France · Belgique · Suisse · Québec · Afrique francophone
        </p>
      </div>
    </section>
  );
}
