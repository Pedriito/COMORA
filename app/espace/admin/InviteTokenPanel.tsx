'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { createInviteToken, revokeInviteToken, resetInviteTokenUses, type InviteToken } from './invite-token-actions'
import { siteUrl } from '@/lib/site'

type Props = { initial: InviteToken[] }

const EXPIRY_OPTIONS = [
  { label: 'Sans limite', value: 0 },   // défaut : pas d'expiration
  { label: '30 jours',   value: 30 },
  { label: '7 jours',    value: 7 },
  { label: '3 mois',     value: 90 },
]

function shareUrl(token: string) {
  if (typeof window !== 'undefined') return `${window.location.origin}/espace/rejoindre/${token}`
  return `${siteUrl()}/espace/rejoindre/${token}`
}

function isExpired(t: InviteToken) {
  return !!t.revoked_at || (!!t.expires_at && new Date(t.expires_at) < new Date())
}

function isMaxed(t: InviteToken) {
  return !!t.max_uses && t.uses_count >= t.max_uses
}

export default function InviteTokenPanel({ initial }: Props) {
  const [tokens, setTokens]     = useState<InviteToken[]>(initial)
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Jeton en clair du lien qui vient d'être créé : affiché une seule fois, jamais relu
  const [fresh, setFresh] = useState<{ id: string; token: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function copyLink(id: string, token: string) {
    navigator.clipboard.writeText(shareUrl(token)).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = await createInviteToken(fd)
      if (res.ok) {
        setTokens(prev => [res.invite, ...prev])
        setFresh({ id: res.invite.id, token: res.token })
        setCreating(false)
      } else {
        setError(res.error)
      }
    })
  }

  function handleRevoke(tokenId: string) {
    if (!confirm('Désactiver ce lien ? Les personnes ayant déjà le lien ne pourront plus s\'inscrire.')) return
    startTransition(async () => {
      await revokeInviteToken(tokenId)
      setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, revoked_at: new Date().toISOString() } : t))
    })
  }

  function handleResetUses(tokenId: string) {
    startTransition(async () => {
      await resetInviteTokenUses(tokenId, null)  // remet uses_count à 0 et max_uses à illimité
      setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, uses_count: 0, max_uses: null } : t))
    })
  }

  // "active" = ni révoqué ni expiré (peut être maxé → montré avec ⚠️ + bouton Corriger)
  const active  = tokens.filter(t => !isExpired(t))
  // "dead"   = révoqué OU date dépassée (lien définitivement inutilisable)
  const dead    = tokens.filter(t => isExpired(t))

  return (
    <div className="space-y-4">
      {/* Tokens actifs */}
      {active.length === 0 && !creating && (
        <p className="font-sans text-xs text-dark/30 italic">Aucun lien actif.</p>
      )}

      {active.map(t => (
        <div key={t.id} className="bg-white rounded-xl border border-teal/20 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {t.label && (
                <p className="font-sans text-xs text-teal/70 uppercase tracking-wide mb-0.5">{t.label}</p>
              )}
              {fresh?.id === t.id ? (
                <p className="font-mono text-xs text-dark/50 truncate">{shareUrl(fresh.token)}</p>
              ) : (
                <p className="font-sans text-xs text-dark/40">
                  Lien créé le {new Date(t.created_at).toLocaleDateString('fr-FR')}
                </p>
              )}
              <div className="flex gap-3 mt-1 flex-wrap">
                <span className="font-sans text-[10px] text-dark/30">
                  {t.uses_count} inscription{t.uses_count !== 1 ? 's' : ''}
                  {t.max_uses
                    ? <span className={`ml-1 font-medium ${t.uses_count >= t.max_uses - 1 ? 'text-amber-500' : 'text-dark/30'}`}>
                        / {t.max_uses} max
                      </span>
                    : <span className="ml-1 text-dark/25"> (illimité)</span>
                  }
                </span>
                {t.expires_at && (
                  <span className="font-sans text-[10px] text-dark/30">
                    Expire le {new Date(t.expires_at).toLocaleDateString('fr-FR')}
                  </span>
                )}
                {!t.expires_at && (
                  <span className="font-sans text-[10px] text-dark/25">Sans expiration</span>
                )}
              </div>

              {/* Avertissement si limite atteinte */}
              {isMaxed(t) && (
                <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  <span className="text-amber-500 text-xs">⚠️</span>
                  <span className="font-sans text-[11px] text-amber-700">
                    Limite atteinte ({t.uses_count}/{t.max_uses}) — personne ne peut plus s'inscrire avec ce lien.
                  </span>
                  <button
                    onClick={() => handleResetUses(t.id)}
                    disabled={isPending}
                    className="ml-auto font-sans text-[11px] text-amber-600 underline hover:text-amber-800 disabled:opacity-40 shrink-0"
                  >
                    Corriger →
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              {fresh?.id === t.id && (
              <button
                onClick={() => copyLink(t.id, fresh.token)}
                className={`px-3 py-1.5 rounded-lg font-sans text-xs font-medium transition-colors ${
                  copiedId === t.id ? 'bg-green-500 text-white' : 'bg-teal text-white hover:bg-teal/90'
                }`}
              >
                {copiedId === t.id ? '✓ Copié' : 'Copier'}
              </button>
              )}
              <button
                onClick={() => handleRevoke(t.id)}
                disabled={isPending}
                className="px-3 py-1.5 rounded-lg border border-red-200 font-sans text-xs text-red-400 hover:bg-red-50 transition-colors"
              >
                Désactiver
              </button>
            </div>
          </div>

          {fresh?.id === t.id ? (
            <>
              <p className="font-sans text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                Copie ce lien maintenant : pour des raisons de sécurité, il ne sera plus affiché. Tu pourras toujours en créer un nouveau.
              </p>
              {/* QR code */}
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=6&data=${encodeURIComponent(shareUrl(fresh.token))}`}
                alt="QR Code"
                width={120}
                height={120}
                unoptimized
                className="rounded-lg border border-teal/10"
              />
            </>
          ) : null}
        </div>
      ))}

      {error && <p className="font-sans text-xs text-red-500">{error}</p>}

      {/* Formulaire de création */}
      {creating ? (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-teal/30 p-4 space-y-3">
          <p className="font-sans text-xs font-medium text-dark/60 uppercase tracking-widest">Nouveau lien</p>
          <input
            name="label"
            placeholder="Label (ex : WhatsApp louange, Réunion juin…)"
            autoComplete="off"
            className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans text-dark placeholder:text-dark/30 focus:outline-none focus:border-teal/50"
          />
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="font-sans text-xs text-dark/40">Expiration</label>
              <select name="expiry_days" className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans text-dark focus:outline-none focus:ring-2 focus:ring-teal/30">
                {EXPIRY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="font-sans text-xs text-dark/40">
                Nb max d'inscriptions
                <span className="ml-1 text-dark/25 normal-case">(laisser vide = illimité)</span>
              </label>
              <input
                name="max_uses"
                type="number"
                min={0}
                autoComplete="off"
                placeholder="Illimité"
                className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans text-dark placeholder:text-dark/30 focus:outline-none focus:border-teal/50"
              />
            </div>
          </div>
          <p className="font-sans text-[11px] text-dark/35 bg-teal/5 rounded-lg px-3 py-2">
            💡 Laisse les deux champs par défaut pour un lien permanent et illimité, idéal pour un groupe WhatsApp.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="flex-1 py-2 rounded-lg border border-teal/20 font-sans text-xs text-dark/60 hover:bg-teal/5"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 rounded-lg bg-teal text-white font-sans text-xs font-medium hover:bg-teal/90 disabled:opacity-40"
            >
              Générer le lien
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full py-2.5 rounded-xl border border-dashed border-teal/30 font-sans text-xs text-dark/40 hover:text-teal hover:border-teal/60 transition-colors"
        >
          + Créer un lien d'inscription
        </button>
      )}

      {/* Tokens révoqués / date expirée */}
      {dead.length > 0 && (
        <details className="mt-2">
          <summary className="font-sans text-xs text-dark/30 cursor-pointer hover:text-dark/50">
            {dead.length} lien{dead.length > 1 ? 's' : ''} désactivé{dead.length > 1 ? 's' : ''} / expiré{dead.length > 1 ? 's' : ''}
          </summary>
          <div className="mt-2 space-y-1.5">
            {dead.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-dark/5 rounded-lg opacity-50">
                <div className="min-w-0">
                  {t.label && <span className="font-sans text-xs text-dark/60 mr-2">{t.label}</span>}
                  <span className="font-sans text-[10px] text-dark/40">
                    {t.uses_count} inscription{t.uses_count !== 1 ? 's' : ''}
                    {t.revoked_at ? ' · désactivé' : ' · expiré'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
