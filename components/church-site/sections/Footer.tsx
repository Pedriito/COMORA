import WaveDivider from "../WaveDivider"
import type { ChurchSettings } from "@/lib/churchSettings"

export default function Footer({ settings: s }: { settings: ChurchSettings }) {
  const address = [s.address_street, [s.address_zip, s.address_city].filter(Boolean).join(' '), s.address_dept].filter(Boolean).join(' · ')

  return (
    <footer className="bg-dark text-white py-12 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <WaveDivider color="rgba(255,255,255,0.2)" className="mb-6" />
        <p className="font-display text-lg font-light tracking-[0.15em] uppercase mb-2">
          {s.church_name}
        </p>
        {address && <p className="font-sans text-xs text-white/40 mb-6">{address}</p>}
        <div className="flex justify-center flex-wrap gap-6">
          {s.youtube_url && (
            <a
              href={s.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-xs tracking-widest uppercase text-white/40 hover:text-white/80 transition-colors"
            >
              YouTube
            </a>
          )}
          {s.email && (
            <a
              href={`mailto:${s.email}`}
              className="font-sans text-xs tracking-widest uppercase text-white/40 hover:text-white/80 transition-colors"
            >
              Email
            </a>
          )}
          <a
            href="/espace/dashboard"
            className="font-sans text-xs tracking-widest uppercase text-white/20 hover:text-white/50 transition-colors"
          >
            Espace bénévoles
          </a>
        </div>
        <p className="font-sans text-xs text-white/20 mt-8">
          © {new Date().getFullYear()} {s.church_name}
        </p>
        <p className="font-sans text-xs text-white/20 mt-2">
          Site propulsé par{" "}
          <a href="https://comora.fr" className="underline underline-offset-2 hover:text-white/50">
            Comora — Votre église, rassemblée.
          </a>
        </p>
      </div>
    </footer>
  )
}
