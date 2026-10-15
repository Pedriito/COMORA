import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Eyebrow } from "@/components/landing/eyebrow";
import { BenefitList } from "@/components/landing/founders";
import { WaitlistForm } from "@/components/landing/waitlist-form";

export const metadata: Metadata = {
  title: "Demander mon accès",
  description:
    "Devenez l’une des 20 églises fondatrices de Comora : accès gratuit jusqu’au lancement, installation accompagnée et tarif bloqué à vie.",
  alternates: { canonical: "/demande-acces" },
};

export default function DemandeAccesPage() {
  return (
    <div className="min-h-svh bg-ink text-sand">
      <header className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-5 py-5 sm:px-7">
        <Link href="/" aria-label="Accueil Comora" className="flex">
          <Logo size={34} word="serif" color="#efece3" />
        </Link>
        <Link href="/" className="text-[15px] font-medium text-mist transition-colors hover:text-sand">
          Retour à l’accueil
        </Link>
      </header>

      <main className="px-5 pt-10 pb-24 sm:px-7 lg:pt-16 lg:pb-[140px]">
        <div className="mx-auto grid max-w-[1240px] items-start gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-6 lg:sticky lg:top-10">
            <Eyebrow onDark>Accès anticipé</Eyebrow>
            <h1 className="font-display text-[clamp(42px,5vw,68px)] leading-[0.98] font-semibold">
              Devenez l’une des 20 églises fondatrices.
            </h1>
            <p className="max-w-[520px] text-[18px] leading-[1.6] text-pretty text-mist">
              Parlez-nous de votre église. Nous choisissons des églises dont le quotidien ressemble au
              nôtre, pour construire Comora avec elles avant l’ouverture à toutes les églises le 1er
              décembre.
            </p>
            <BenefitList />
          </div>

          <div className="flex flex-col gap-6 rounded-[28px] border border-moss-light bg-ink-card p-6 sm:p-9">
            <h2 className="font-display text-[30px] leading-[1.1] font-semibold">Demander mon accès</h2>
            <WaitlistForm />
          </div>
        </div>
      </main>
    </div>
  );
}
