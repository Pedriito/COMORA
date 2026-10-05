import type { Metadata } from "next";
import { AppShowcase } from "@/components/landing/app-showcase";
import { Faq } from "@/components/landing/faq";
import { FeatureStage } from "@/components/landing/feature-stage";
import { FinalCta } from "@/components/landing/final-cta";
import { Founders } from "@/components/landing/founders";
import { Hero } from "@/components/landing/hero";
import { Manifesto } from "@/components/landing/manifesto";
import { Origin } from "@/components/landing/origin";
import { Pillars } from "@/components/landing/pillars";
import { Pricing } from "@/components/landing/pricing";
import { ScrollEffects } from "@/components/landing/scroll-effects";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    // overflow-x: clip retient les cartes qui débordent sans casser position: sticky.
    <div className="overflow-x-clip">
      <SiteHeader />
      <main>
        <Hero />
        <FeatureStage />
        <Pillars />
        <Manifesto />
        <AppShowcase />
        <Founders />
        <Pricing />
        <Origin />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
      <ScrollEffects />
    </div>
  );
}
