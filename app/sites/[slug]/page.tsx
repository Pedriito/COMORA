import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/church-site/Navbar";
import Hero from "@/components/church-site/sections/Hero";
import Horaires from "@/components/church-site/sections/Horaires";
import Cultes from "@/components/church-site/sections/Cultes";
import Pasteurs from "@/components/church-site/sections/Pasteurs";
import Contact from "@/components/church-site/sections/Contact";
import Footer from "@/components/church-site/sections/Footer";
import { getChurchBySlug, getChurchSchedules, getChurchSettings } from "@/lib/churchSettings";
import { churchThemeStyle } from "@/lib/brand/theme";

export const revalidate = 3600;

async function loadChurch(slug: string) {
  const church = await getChurchBySlug(slug);
  if (!church) notFound();
  const [settings, schedules] = await Promise.all([
    getChurchSettings(church.id, church.name),
    getChurchSchedules(church.id),
  ]);
  return { church, settings, schedules };
}

export async function generateMetadata({ params }: PageProps<"/sites/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { settings } = await loadChurch(slug);
  const place = settings.address_city ? ` — ${settings.address_city}` : "";
  return {
    title: { absolute: `${settings.church_name}${place}` },
    description: settings.tagline || undefined,
  };
}

export default async function ChurchSitePage({ params }: PageProps<"/sites/[slug]">) {
  const { slug } = await params;
  const { church, settings: s, schedules } = await loadChurch(slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Church",
    name: s.church_name,
    description: s.tagline || undefined,
    address: s.address_street
      ? {
          "@type": "PostalAddress",
          streetAddress: s.address_street,
          postalCode: s.address_zip,
          addressLocality: s.address_city,
        }
      : undefined,
    email: s.email || undefined,
    sameAs: s.youtube_url ? [s.youtube_url] : [],
  };

  return (
    // Offre Signature : couleurs de l'église à la place du thème Comora
    <div style={churchThemeStyle(church.branding)}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Navbar churchName={s.church_name} />
      <main>
        <Hero settings={s} />
        <Horaires settings={s} schedules={schedules} />
        <Cultes settings={s} />
        <Pasteurs settings={s} />
        <Contact settings={s} />
      </main>
      <Footer settings={s} />
    </div>
  );
}
