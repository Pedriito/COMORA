import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-ink px-5 py-16 text-sand">
      <div className="flex max-w-[480px] flex-col items-center gap-6 text-center">
        <Logo size={56} word="none" color="#efece3" />
        <h1 className="font-display text-5xl leading-none font-semibold">Page introuvable</h1>
        <p className="text-lg text-mist">Cette page n’existe pas ou a été déplacée.</p>
        <Link href="/" className={buttonClasses({ variant: "accent", size: "lg", shape: "pill" })}>
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
