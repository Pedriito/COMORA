import WaveDivider from "../WaveDivider"
import type { ChurchSchedule, ChurchSettings } from "@/lib/churchSettings"

const ICONS = [
  // soleil
  <svg key="sun" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
  </svg>,
  // cœur
  <svg key="heart" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>,
  // étoile
  <svg key="star" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
  </svg>,
  // croix
  <svg key="cross" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v18M3 12h18" />
  </svg>,
]

export default function Horaires({ settings, schedules }: { settings: ChurchSettings; schedules: ChurchSchedule[] }) {
  if (schedules.length === 0) return null
  const address = [settings.address_street, [settings.address_zip, settings.address_city].filter(Boolean).join(' ')].filter(Boolean).join(' · ')

  return (
    <section id="horaires" className="py-24 px-6 bg-white">
      <div className="max-w-4xl mx-auto text-center">
        <p className="font-sans text-xs tracking-[0.3em] uppercase text-teal mb-3">
          Rejoignez-nous
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-light text-dark mb-1">
          Horaires
        </h2>
        <WaveDivider color="var(--color-teal)" className="mt-2 mb-10" />

        <div className={`grid gap-8 ${schedules.length === 1 ? 'max-w-sm mx-auto' : 'md:grid-cols-2'}`}>
          {schedules.map((s, i) => (
            <div
              key={s.id}
              className="border border-teal-light rounded-sm p-8 text-left hover:border-teal transition-colors"
            >
              <div className="text-teal mb-4">{ICONS[i % ICONS.length]}</div>
              <p className="font-sans text-xs tracking-[0.25em] uppercase text-teal mb-2">
                {s.day_of_week}
              </p>
              <h3 className="font-display text-2xl font-semibold text-dark mb-1">
                {s.event_name}
              </h3>
              <p className="font-display text-xl text-teal-dark font-light mb-2">
                {s.start_time}{s.end_time ? ` – ${s.end_time}` : ''}
              </p>
              {s.subtitle && <p className="font-sans text-sm text-dark/50">{s.subtitle}</p>}
            </div>
          ))}
        </div>

        {address && <p className="mt-10 font-sans text-sm text-dark/50">{address}</p>}
      </div>
    </section>
  )
}
