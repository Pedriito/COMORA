'use client'

import { useState, useTransition } from 'react'
import { createShareLink, getShareLinkStatus, revokeShareLinks, type ShareLinkStatus } from './share-actions'

type Props = { planId: string }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function ShareButton({ planId }: Props) {
  const [open, setOpen]         = useState(false)
  // Lien en clair : connu seulement juste après sa création
  const [created, setCreated]   = useState<{ token: string; expiresAt: string } | null>(null)
  const [status, setStatus]     = useState<ShareLinkStatus | undefined>(undefined)
  const [error, setError]       = useState(false)
  const [copied, setCopied]     = useState(false)
  const [isPending, startTransition] = useTransition()

  function shareUrl(t: string) {
    return `${window.location.origin}/partage/${t}`
  }

  function handleOpen() {
    setOpen(true)
    setError(false)
    if (!created) {
      startTransition(async () => {
        setStatus(await getShareLinkStatus(planId))
      })
    }
  }

  function copyLink() {
    if (!created) return
    navigator.clipboard.writeText(shareUrl(created.token)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleCreate() {
    if (status && !confirm('Créer un nouveau lien ?\nL\'ancien lien ne fonctionnera plus.')) return
    setError(false)
    startTransition(async () => {
      const link = await createShareLink(planId)
      if (!link) { setError(true); return }
      setCreated(link)
      setStatus({ expiresAt: link.expiresAt })
    })
  }

  function handleRevoke() {
    if (!confirm('Révoquer le lien de partage ?\nIl ne fonctionnera plus.')) return
    setError(false)
    startTransition(async () => {
      const res = await revokeShareLinks(planId)
      if (!res.ok) { setError(true); return }
      setCreated(null)
      setStatus(null)
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

            {status === undefined && isPending ? (
              <p className="font-sans text-sm text-dark/40 text-center py-4">Chargement…</p>
            ) : created ? (
              <>
                {/* URL copiable : affichée une seule fois */}
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={shareUrl(created.token)}
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
                  Copie ce lien maintenant : il ne sera plus affiché ensuite.
                  Il donne accès aux chants et aux grilles d&apos;accords en lecture seule
                  jusqu&apos;au {formatDate(created.expiresAt)}.
                </p>
              </>
            ) : status ? (
              <p className="font-sans text-sm text-dark/60 text-center leading-snug">
                Un lien de partage est actif jusqu&apos;au {formatDate(status.expiresAt)}.
                <br />
                <span className="text-xs text-dark/40">Pour l&apos;envoyer à nouveau, crée un nouveau lien.</span>
              </p>
            ) : (
              <p className="font-sans text-sm text-dark/50 text-center leading-snug">
                Aucun lien actif. Le lien créé reste valable 30 jours.
              </p>
            )}

            {error && (
              <p className="font-sans text-sm text-red-400 text-center">Une erreur est survenue.</p>
            )}

            {status !== undefined && (
              <div className="space-y-2">
                <button
                  onClick={handleCreate}
                  disabled={isPending}
                  className="w-full py-2 rounded-lg bg-teal text-white font-sans text-xs font-medium hover:bg-teal/90 transition-colors disabled:opacity-40"
                >
                  {status ? '🔄 Nouveau lien (révoque l\'ancien)' : 'Créer un lien'}
                </button>
                {status && (
                  <button
                    onClick={handleRevoke}
                    disabled={isPending}
                    className="w-full py-2 rounded-lg border border-red-200 font-sans text-xs text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    Révoquer le lien
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
