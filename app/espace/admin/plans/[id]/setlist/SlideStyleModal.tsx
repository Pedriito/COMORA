'use client'

import { useState, useTransition } from 'react'
import { SLIDE_PRESETS, PRESET_KEYFRAMES, type SlideStyle, type SlideLayout } from '@/lib/slidePresets'
import { saveArrangementSlideStyle } from './slide-style-action'

type Props = {
  songTitle: string
  arrangementId: string
  planId: string
  initialStyle: SlideStyle | null
  onClose: () => void
  onSaved: (newStyle: SlideStyle | null) => void
}

const BAND_COLORS = [
  { label: 'Noir', value: 'rgba(0,0,0,0.70)' },
  { label: 'Sombre', value: 'rgba(10,10,30,0.80)' },
  { label: 'Blanc', value: 'rgba(255,255,255,0.15)' },
  { label: 'Bordeaux', value: 'rgba(80,10,20,0.80)' },
  { label: 'Marine', value: 'rgba(5,15,50,0.80)' },
  { label: 'Forêt', value: 'rgba(5,30,15,0.80)' },
]

export function SlideStyleModal({ songTitle, arrangementId, planId, initialStyle, onClose, onSaved }: Props) {
  const [preset, setPreset]     = useState<string | null>(initialStyle?.preset ?? null)
  const [layout, setLayout]     = useState<SlideLayout>(initialStyle?.layout ?? 'fullscreen')
  const [textColor, setTextColor] = useState<string>(initialStyle?.text_color ?? '#ffffff')
  const [bandColor, setBandColor] = useState<string>(initialStyle?.band_color ?? 'rgba(0,0,0,0.70)')
  const [useColorOverride, setUseColorOverride] = useState(!!initialStyle?.text_color)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const newStyle: SlideStyle | null = preset == null && layout === 'fullscreen' && !useColorOverride ? null : {
      preset: preset ?? null,
      layout,
      text_color: useColorOverride ? textColor : null,
      band_color: layout === 'band' ? bandColor : null,
    }
    startTransition(async () => {
      const res = await saveArrangementSlideStyle(arrangementId, newStyle, planId)
      if (res.ok) {
        onSaved(newStyle)
        onClose()
      }
    })
  }

  function handleReset() {
    startTransition(async () => {
      const res = await saveArrangementSlideStyle(arrangementId, null, planId)
      if (res.ok) {
        onSaved(null)
        onClose()
      }
    })
  }

  return (
    <>
      <style>{PRESET_KEYFRAMES}</style>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-sans text-xs text-dark/40 uppercase tracking-widest mb-0.5">Apparence de la projection</p>
                <h2 className="font-display text-xl text-dark font-light">{songTitle}</h2>
              </div>
              <button onClick={onClose} className="text-dark/30 hover:text-dark transition-colors p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-6">

            {/* Layout */}
            <div>
              <p className="font-sans text-xs text-dark/40 uppercase tracking-widest mb-3">Disposition</p>
              <div className="grid grid-cols-2 gap-3">
                {/* Plein écran */}
                <button
                  onClick={() => setLayout('fullscreen')}
                  className={`relative rounded-2xl border-2 p-4 text-left transition-colors ${layout === 'fullscreen' ? 'border-teal bg-teal/5' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="w-full aspect-video bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                    <div className="space-y-1.5 text-center px-4">
                      <div className="h-1.5 bg-gray-400 rounded-full w-full" />
                      <div className="h-1.5 bg-gray-400 rounded-full w-4/5 mx-auto" />
                    </div>
                  </div>
                  <p className="font-sans text-sm font-medium text-dark">Plein écran</p>
                  <p className="font-sans text-xs text-dark/40 mt-0.5">Texte centré sur le fond</p>
                  {layout === 'fullscreen' && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-teal flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                  )}
                </button>

                {/* Bande centrale */}
                <button
                  onClick={() => setLayout('band')}
                  className={`relative rounded-2xl border-2 p-4 text-left transition-colors ${layout === 'band' ? 'border-teal bg-teal/5' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="w-full aspect-video bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    <div className="w-full bg-gray-400/40 py-1.5 flex items-center justify-center">
                      <div className="space-y-1 text-center px-4">
                        <div className="h-1.5 bg-gray-500 rounded-full w-full" />
                        <div className="h-1.5 bg-gray-500 rounded-full w-3/4 mx-auto" />
                      </div>
                    </div>
                  </div>
                  <p className="font-sans text-sm font-medium text-dark">Bande centrale</p>
                  <p className="font-sans text-xs text-dark/40 mt-0.5">Texte dans une bande horizontale</p>
                  {layout === 'band' && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-teal flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Fond animé */}
            <div>
              <p className="font-sans text-xs text-dark/40 uppercase tracking-widest mb-3">Fond animé</p>
              {/* "Paramètres globaux" option */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                <button
                  onClick={() => setPreset(null)}
                  className={`rounded-xl border-2 p-3 text-center transition-colors ${preset === null ? 'border-teal bg-teal/5' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="w-full aspect-video bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg mb-2 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="font-sans text-xs text-dark/60">Globaux</p>
                </button>

                {SLIDE_PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id)}
                    className={`rounded-xl border-2 p-3 text-center transition-colors ${preset === p.id ? 'border-teal bg-teal/5' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div
                      className="w-full aspect-video rounded-lg mb-2"
                      style={{ ...p.bgStyle, backgroundSize: '400% 400%' }}
                    />
                    <p className="font-sans text-xs text-dark/60 truncate">{p.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Couleur de la bande */}
            {layout === 'band' && (
              <div>
                <p className="font-sans text-xs text-dark/40 uppercase tracking-widest mb-3">Couleur de la bande</p>
                <div className="flex flex-wrap gap-2">
                  {BAND_COLORS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setBandColor(c.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-sans transition-colors ${bandColor === c.value ? 'border-teal bg-teal/5 text-dark' : 'border-gray-200 hover:border-gray-300 text-dark/60'}`}
                    >
                      <span className="w-4 h-4 rounded-full border border-gray-300/50 shrink-0" style={{ background: c.value }} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Couleur du texte */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useColorOverride}
                  onChange={e => setUseColorOverride(e.target.checked)}
                  className="w-4 h-4 rounded accent-teal"
                />
                <p className="font-sans text-sm text-dark">Couleur du texte personnalisée</p>
              </label>
              {useColorOverride && (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="color"
                    value={textColor}
                    onChange={e => setTextColor(e.target.value)}
                    className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer p-0.5"
                  />
                  <p className="font-sans text-xs text-dark/50">{textColor}</p>
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-2 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 bg-teal text-white font-sans text-sm font-medium py-3 rounded-2xl hover:bg-teal/90 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {initialStyle && (
              <button
                onClick={handleReset}
                disabled={isPending}
                className="px-4 py-3 rounded-2xl border border-gray-200 font-sans text-sm text-dark/50 hover:text-dark hover:border-gray-300 transition-colors disabled:opacity-50"
              >
                Réinitialiser
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-2xl border border-gray-200 font-sans text-sm text-dark/50 hover:text-dark hover:border-gray-300 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
