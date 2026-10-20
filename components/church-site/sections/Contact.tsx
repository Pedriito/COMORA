import WaveDivider from "../WaveDivider"
import type { ChurchSettings } from "@/lib/churchSettings"

export default function Contact({ settings: s }: { settings: ChurchSettings }) {
  if (!s.address_street && !s.email) return null

  return (
    <section id="contact" className="py-24 px-6 bg-teal-50">
      <div className="max-w-4xl mx-auto text-center">
        <p className="font-sans text-xs tracking-[0.3em] uppercase text-teal mb-3">
          Venir nous voir
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-light text-dark mb-1">
          Contact
        </h2>
        <WaveDivider color="var(--color-teal)" className="mt-2 mb-10" />

        <div className="grid md:grid-cols-2 gap-8 text-left">
          {s.address_street && (
          <div className="border border-teal-light bg-white rounded-sm p-8">
            <div className="text-teal mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-semibold text-dark mb-2">Adresse</h3>
            <p className="font-sans text-sm text-dark/70 leading-relaxed">
              {s.address_street}<br />
              {s.address_zip} {s.address_city}<br />
              {s.address_dept}
            </p>
            {s.maps_url && (
            <a
              href={s.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-4 font-sans text-xs tracking-widest uppercase text-teal hover:text-teal-dark transition-colors"
            >
              Ouvrir dans Maps
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            )}
          </div>
          )}

          {s.email && (
          <div className="border border-teal-light bg-white rounded-sm p-8">
            <div className="text-teal mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-semibold text-dark mb-2">Email</h3>
            <a
              href={`mailto:${s.email}`}
              className="font-sans text-sm text-teal hover:text-teal-dark transition-colors"
            >
              {s.email}
            </a>
            <p className="font-sans text-sm text-dark/50 mt-4 leading-relaxed">
              Pour toute question, demande de renseignement ou simplement pour nous dire bonjour.
            </p>
          </div>
          )}
        </div>
      </div>
    </section>
  )
}
