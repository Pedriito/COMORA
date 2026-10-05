import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false },
};

/**
 * Point d'entrée de l'espace membre. L'application viendra s'installer dans
 * ce groupe de routes (app/(app)) ; en attendant, la page oriente vers la
 * demande d'accès.
 */
export default function ConnexionPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-ink px-5 py-16 text-sand">
      <div className="flex max-w-[520px] flex-col items-center gap-7 text-center">
        <Link href="/" aria-label="Accueil Comora">
          <Logo size={56} word="none" color="#efece3" />
        </Link>
        <h1 className="font-display text-[clamp(40px,6vw,56px)] leading-none font-semibold">
          Votre espace Comora ouvre bientôt.
        </h1>
        <p className="text-lg leading-[1.6] text-pretty text-mist">
          Les églises fondatrices reçoivent leur accès par e-mail dès que leur espace est prêt.
          Ouverture à toutes les églises le 1er décembre.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <Link href="/#fondatrices" className={buttonClasses({ variant: "accent", size: "lg", shape: "pill" })}>
            Demander mon accès
          </Link>
          <Link
            href="/"
            className="flex h-11 items-center rounded-full border border-sand/40 px-5 text-sm font-semibold transition-colors hover:bg-sand/10"
          >
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
