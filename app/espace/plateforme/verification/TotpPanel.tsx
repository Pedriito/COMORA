'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Setup = { factorId: string; qrCode: string; secret: string }

/**
 * Deuxième étape du back-office : code à 6 chiffres d'une application d'authentification.
 * Première visite : on propose d'enregistrer l'application (QR code), puis on vérifie un code.
 */
export function TotpPanel() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [factorId, setFactorId] = useState<string | null>(null)
  const [setup, setSetup] = useState<Setup | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: listError } = await supabase.auth.mfa.listFactors()
      if (cancelled) return
      if (listError) { setError('Impossible de charger la vérification. Réessayez.'); setLoading(false); return }
      const verified = data?.totp?.[0]
      if (verified) { setFactorId(verified.id); setLoading(false); return }
      // Une inscription abandonnée est remplacée par une nouvelle
      for (const f of data?.all ?? []) if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Back-office Comora' })
      if (cancelled) return
      if (enrollError || !enrolled) setError('Impossible d’enregistrer l’application. Réessayez.')
      else {
        setFactorId(enrolled.id)
        setSetup({ factorId: enrolled.id, qrCode: enrolled.totp.qr_code, secret: enrolled.totp.secret })
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [supabase])

  async function verify(event: React.FormEvent) {
    event.preventDefault()
    if (!factorId || busy) return
    setBusy(true)
    setError(null)
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError || !challenge) { setError('Une erreur est survenue. Réessayez.'); setBusy(false); return }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.trim() })
    if (verifyError) { setError('Code incorrect ou expiré. Réessayez avec le code affiché.'); setBusy(false); setCode(''); return }
    router.replace('/espace/plateforme')
    router.refresh()
  }

  if (loading) return <p className="font-sans text-sm text-dark/60 text-center">Chargement…</p>

  return (
    <form onSubmit={verify} className="space-y-5">
      {setup ? (
        <div className="space-y-3 text-center">
          <p className="font-sans text-sm text-dark/70">Première connexion : scannez ce code avec votre application d’authentification (Google Authenticator, 1Password, Authy…).</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qrCode} alt="QR code à scanner avec l’application d’authentification" className="mx-auto h-44 w-44" />
          <p className="font-sans text-xs text-dark/50">Ou saisissez la clé : <code className="break-all select-all">{setup.secret}</code></p>
        </div>
      ) : (
        <p className="font-sans text-sm text-dark/70 text-center">Saisissez le code à 6 chiffres de votre application d’authentification.</p>
      )}
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        aria-label="Code à 6 chiffres"
        className="w-full rounded-xl border border-teal/30 px-4 py-3 text-center font-sans text-2xl tracking-[0.4em]"
      />
      {error && <p role="alert" className="font-sans text-sm text-red-700 text-center">{error}</p>}
      <button type="submit" disabled={busy || code.length !== 6 || !factorId} className="w-full rounded-xl bg-dark px-6 py-3 font-sans text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Vérification…' : 'Valider'}
      </button>
    </form>
  )
}
