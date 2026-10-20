'use client'

import { useState, useTransition } from 'react'
import { registerViaToken } from './register-action'
import { PasswordInput } from '../../_components/PasswordInput'

type Props = { token: string; churchName?: string }

export function RegisterForm({ token, churchName = 'ton église' }: Props) {
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, start]      = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('token', token)
    start(async () => {
      const res = await registerViaToken(fd)
      if (res.ok) setDone(true)
      else setError(res.error)
    })
  }

  if (done) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="text-5xl">🎉</div>
        <h2 className="font-display text-2xl text-dark font-light">Bienvenue !</h2>
        <p className="font-sans text-sm text-dark/60 leading-relaxed">
          Ton compte a bien été créé.<br />
          Un email t'a été envoyé pour créer ton mot de passe et accéder à l'espace bénévoles.
        </p>
        <p className="font-sans text-xs text-dark/30">Pense à vérifier tes spams si tu ne vois pas l'email.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-sans text-dark/60 mb-1.5 uppercase tracking-widest">Prénom *</label>
          <input
            name="first_name"
            required
            autoComplete="given-name"
            className="w-full px-3 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-sans text-dark/60 mb-1.5 uppercase tracking-widest">Nom *</label>
          <input
            name="last_name"
            required
            autoComplete="family-name"
            className="w-full px-3 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-sans text-dark/60 mb-1.5 uppercase tracking-widest">Adresse email *</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full px-3 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm"
          placeholder="prenom@exemple.com"
        />
      </div>

      <div>
        <label className="block text-xs font-sans text-dark/60 mb-1.5 uppercase tracking-widest">Téléphone</label>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          className="w-full px-3 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm"
          placeholder="06 12 34 56 78"
        />
      </div>

      {error && (
        <p className="font-sans text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 bg-teal text-white rounded-lg font-sans text-sm font-medium hover:bg-teal/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Création du compte…' : 'Rejoindre l\'équipe'}
      </button>

      <p className="font-sans text-xs text-dark/30 text-center">
        Un email de connexion te sera envoyé pour créer ton mot de passe.
      </p>
    </form>
  )
}
