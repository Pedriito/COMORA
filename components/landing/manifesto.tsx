import Image from "next/image";
import assembleeImage from "@/assets/images/assemblee.jpg";
import { cx } from "@/components/ui/cx";

const WORDS = [
  { text: "Moins" },
  { text: "d’administratif." },
  { text: "Plus", accent: true },
  { text: "de", accent: true },
  { text: "temps", accent: true },
  { text: "pour" },
  { text: "les" },
  { text: "personnes." },
];

/** La phrase s'allume mot après mot pendant que la section reste à l'écran. */
export function Manifesto() {
  return (
    <section data-scroll-stage className="relative h-[220vh] bg-ink">
      <div className="sticky top-0 flex h-svh items-center justify-center overflow-hidden">
        <Image
          src={assembleeImage}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          style={{
            transform: "scale(calc(1.25 - var(--p) * 0.25))",
            opacity: "calc(0.25 + var(--p) * 0.3)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(22,36,31,0.4),rgba(22,36,31,0.92))]"
        />
        <p className="relative max-w-[1100px] px-5 text-center font-display text-[clamp(44px,6.4vw,96px)] leading-[1.02] font-semibold text-sand sm:px-7">
          <span className="sr-only">Moins d’administratif. Plus de temps pour les personnes.</span>
          <span aria-hidden="true" className="flex flex-wrap justify-center gap-x-[0.28em]">
            {WORDS.map((word, i) => (
              <span
                key={word.text}
                data-word
                className={cx(word.accent && "text-coral-light italic")}
                style={{ opacity: `clamp(0.14, calc(var(--p) * ${WORDS.length + 2} - ${i}), 1)` }}
              >
                {word.text}
              </span>
            ))}
          </span>
        </p>
      </div>
    </section>
  );
}
