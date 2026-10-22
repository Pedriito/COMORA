import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/landing/site-footer";

/** Gabarit des pages légales : en-tête sobre, bandeau « texte provisoire », contenu lisible. */
export function LegalPage({ title, version, children }: { title: string; version: string; children: ReactNode }) {
  return (
    <div className="bg-sand">
      <header className="mx-auto flex max-w-[860px] items-center justify-between gap-6 px-5 py-6 sm:px-7">
        <Link href="/" aria-label="Accueil Comora" className="flex">
          <Logo size={34} word="serif" />
        </Link>
        <Link href="/" className="text-[15px] font-medium text-slate transition-colors hover:text-ink">
          Retour à l’accueil
        </Link>
      </header>
      <main className="mx-auto max-w-[860px] px-5 pb-24 sm:px-7">
        <p
          role="note"
          className="mb-8 rounded-2xl border border-coral/40 bg-coral-50 px-5 py-4 text-[15px] leading-[1.55] text-coral-deep"
        >
          <strong>Texte provisoire.</strong> Ce document sera remplacé par la version définitive avant l’ouverture
          des abonnements payants. Les passages entre crochets restent à compléter.
        </p>
        <h1 className="font-display text-[clamp(38px,5vw,60px)] leading-[1.02] font-semibold text-ink">{title}</h1>
        <p className="mt-3 text-[14px] text-muted">Version {version}</p>
        <div className="mt-10 flex flex-col gap-9 text-[17px] leading-[1.7] text-slate [&_h2]:font-display [&_h2]:text-[28px] [&_h2]:leading-tight [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1.5">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
