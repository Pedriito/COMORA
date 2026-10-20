'use client'

import { useState } from 'react'
import { IconCalendar } from '@/app/espace/_components/Icons'

export function SubscribeCalendarButton({
  icalUrl,
  label = "S'abonner",
  className,
}: {
  icalUrl: string
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const webcalUrl = icalUrl.replace(/^https?:\/\//, 'webcal://')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(icalUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // pas de clipboard (contexte non sécurisé) — le lien reste sélectionnable à la main
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal/20 font-sans text-xs text-dark/50 hover:text-teal hover:border-teal/40 transition-colors'}
        title="S'abonner au calendrier (Google Calendar, Apple Calendar, Outlook…)"
      >
        <IconCalendar className="w-3.5 h-3.5" /> {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-dark/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-teal/10 shrink-0">
          <div>
            <p className="font-display text-lg text-dark font-light">S'abonner au calendrier</p>
            <p className="font-sans text-xs text-dark/40 mt-0.5">Les services apparaissent automatiquement dans ton agenda.</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fermer"
            className="w-9 h-9 flex items-center justify-center text-dark/40 hover:text-dark transition-colors text-xl leading-none shrink-0"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <a
            href={webcalUrl}
            className="flex items-center justify-center gap-2 w-full py-3 bg-teal text-white rounded-xl font-sans text-sm font-medium hover:bg-teal-dark transition-colors"
          >
            <IconCalendar className="w-4 h-4" /> Ajouter à Calendrier (iPhone / Mac)
          </a>

          <div className="space-y-2">
            <p className="font-sans text-xs uppercase tracking-widest text-dark/40 font-semibold">Google Calendar</p>
            <ol className="list-decimal list-inside space-y-1 font-sans text-sm text-dark/70 marker:text-teal marker:font-medium">
              <li>Sur ordinateur, ouvrir Google Calendar</li>
              <li>À côté de « Autres agendas », cliquer sur <strong className="text-dark">+</strong> puis <strong className="text-dark">À partir d'une URL</strong></li>
              <li>Coller le lien ci-dessous, puis valider</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="font-sans text-xs uppercase tracking-widest text-dark/40 font-semibold">Outlook</p>
            <ol className="list-decimal list-inside space-y-1 font-sans text-sm text-dark/70 marker:text-teal marker:font-medium">
              <li>Dans Outlook.com, ouvrir Calendrier</li>
              <li>Cliquer sur <strong className="text-dark">Ajouter un calendrier</strong> → <strong className="text-dark">S'abonner à partir du web</strong></li>
              <li>Coller le lien ci-dessous, puis valider</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="font-sans text-xs uppercase tracking-widest text-dark/40 font-semibold">Lien à copier</p>
            <div className="flex items-center gap-2 bg-teal-50 border border-teal/20 rounded-lg px-3 py-2">
              <span className="font-mono text-xs text-dark/60 truncate flex-1">{icalUrl}</span>
              <button
                onClick={handleCopy}
                className="font-sans text-xs font-semibold text-teal hover:text-teal-dark transition-colors shrink-0"
              >
                {copied ? '✓ Copié' : 'Copier'}
              </button>
            </div>
            <p className="font-sans text-[11px] text-dark/35">
              Mise à jour automatique : chaque nouveau service ou changement de date apparaît dans ton agenda sans rien refaire.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
