'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { getOrCreateShareToken, regenerateShareToken } from './share-actions'

type Props = { planId: string }

export default function ShareButton({ planId }: Props) {
  const [open, setOpen]         = useState(false)
  const [token, setToken]       = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)
  const [isPending, startTransition] = useTransition()

  function shareUrl(t: string) {
    return `${window.location.origin}/partage/${t}`
  }

  function handleOpen() {
    setOpen(true)
    if (!token) {
      startTransition(async () => {
        const t = await getOrCreateShareToken(planId)
        setToken(t)
      })
    }
  }

  function copyLink() {
    if (!token) return
    navigator.clipboard.writeText(shareUrl(token)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleRegenerate() {
    if (!confirm('Révoquer le lien actuel et en créer un nouveau ?\nL\'ancien lien ne fonctionnera plus.')) return
    startTransition(async () => {
      const t = await regenerateShareToken(planId)
      setToken(t)
    })
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-3 py-1.5 rounded-lg border border-teal/30 bg-white hover:bg-teal/5 font-sans text-xs text-dark/60 hover:text-teal transition-colors flex items-center gap-1.5"
        title="Partager la setlist avec des musiciens invités"
      >
        <span>🔗</span>
        <span>Partager</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
            {/* En-tête */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg text-dark font-light">Partager la setlist</h2>
                <p className="font-sans text-xs text-dark/40 mt-0.5">
                  Musiciens invités — sans compte requis
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-dark/30 hover:text-dark text-xl leading-none mt-0.5">×</button>
            </div>

            {isPending && !token ? (
              <p className="font-sans text-sm text-dark/40 text-center py-4">Génération du lien…</p>
            ) : token ? (
              <>
                {/* QR Code */}
                <div className="flex justify-center">
                  <Image
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(shareUrl(token))}`}
                    alt="QR Code"
                    width={180}
                    height={180}
                    className="rounded-xl border border-teal/10"
                  />
                </div>

                {/* URL copiable */}
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={shareUrl(token)}
                    className="flex-1 min-w-0 border border-teal/20 rounded-lg px-3 py-2 font-mono text-xs text-dark/60 bg-teal/5 focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                  <button
                    onClick={copyLink}
                    className={`shrink-0 px-3 py-2 rounded-lg font-sans text-xs font-medium transition-colors ${
                      copied ? 'bg-green-500 text-white' : 'bg-teal text-white hover:bg-teal/90'
                    }`}
                  >
                    {copied ? '✓ Copié' : 'Copier'}
                  </button>
                </div>

                <p className="font-sans text-[11px] text-dark/35 text-center leading-snug">
                  Ce lien donne accès aux chants et aux grilles d'accords en lecture seule.
                </p>

                {/* Révoquer */}
                <button
                  onClick={handleRegenerate}
                  disabled={isPending}
                  className="w-full py-2 rounded-lg border border-red-200 font-sans text-xs text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  🔄 Révoquer et générer un nouveau lien
                </button>
              </>
            ) : (
              <p className="font-sans text-sm text-red-400 text-center py-4">Erreur lors de la génération.</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
