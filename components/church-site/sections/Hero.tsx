import WaveDivider from "../WaveDivider"
import type { ChurchSettings } from "@/lib/churchSettings"

export default function Hero({ settings: s }: { settings: ChurchSettings }) {
  const place = [s.address_city, s.address_dept].filter(Boolean).join(' · ')

  return (
    <section
      id="accueil"
      className="min-h-screen flex flex-col justify-center items-center text-center bg-teal px-6 pt-16"
      style={{ background: "linear-gradient(170deg, var(--color-teal-dark) 0%, var(--color-teal) 100%)" }}
    >
      <div className="max-w-2xl mx-auto">
        {place && (
          <p className="font-sans text-xs tracking-[0.35em] uppercase text-white/60 mb-6">
            {place}
          </p>
        )}

        <h1 className="font-display text-5xl md:text-7xl font-light text-white leading-tight mb-6">
          {s.church_name.split(' ').length > 1 ? (
            <>
              {s.church_name.split(' ').slice(0, -2).join(' ')}<br />
              <span className="font-semibold italic">{s.church_name.split(' ').slice(-2).join(' ')}</span>
            </>
          ) : (
            <span className="font-semibold italic">{s.church_name}</span>
          )}
        </h1>

        <WaveDivider color="rgba(255,255,255,0.5)" className="my-6" />

        {s.tagline && (
          <p className="font-display text-xl md:text-2xl font-light text-white/80 mb-10 leading-relaxed">
            {s.tagline}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#horaires"
            className="px-8 py-3 bg-white text-teal-dark font-sans text-sm tracking-widest uppercase font-medium hover:bg-teal-50 transition-colors rounded-sm"
          >
            Préparer ma venue
          </a>
          <a
            href="#cultes"
            className="px-8 py-3 border border-white/50 text-white font-sans text-sm tracking-widest uppercase font-medium hover:bg-white/10 transition-colors rounded-sm"
          >
            Voir les cultes
          </a>
        </div>
      </div>

      <div className="absolute bottom-8 animate-bounce">
        <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>
  )
}
