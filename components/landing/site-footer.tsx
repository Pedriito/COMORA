import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="bg-ink-deep px-5 py-14 text-[#9fb0aa] sm:px-7">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6">
        <Logo size={28} word="serif" tagline color="#efece3" />
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-[14px]">
          <nav aria-label="Pied de page" className="flex flex-wrap gap-x-6 gap-y-3">
            <Link href="/#fonctionnalites" className="transition-colors hover:text-sand">
              Fonctionnalités
            </Link>
            <Link href="/#tarifs" className="transition-colors hover:text-sand">
              Tarifs
            </Link>
            <Link href="/#faq" className="transition-colors hover:text-sand">
              Questions
            </Link>
          </nav>
          <nav aria-label="Informations légales" className="flex flex-wrap gap-x-6 gap-y-3">
            <Link href="/cgv" className="transition-colors hover:text-sand">
              Conditions générales
            </Link>
            <Link href="/confidentialite" className="transition-colors hover:text-sand">
              Confidentialité
            </Link>
          </nav>
          <span>© 2026 comora.fr</span>
        </div>
      </div>
    </footer>
  );
}
