'use client'

import { useState, useTransition } from 'react'
import { createChurch } from './actions'

export function ChurchForm() {
  const [pending, startTransition] = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const formData = new FormData(e.currentTarget)
    const form = e.currentTarget
    startTransition(async () => {
      const res = await createChurch(formData)
      if (res.ok) {
        setSuccess(true)
        form.reset()
      } else {
        setError(res.error ?? 'Erreur inconnue')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-teal/10 p-5 space-y-4">
      <p className="font-sans text-xs text-dark/40 uppercase tracking-widest mb-1">Nouvelle église</p>

      <div>
        <label className="block font-sans text-sm text-dark/70 mb-1">Nom de l'église</label>
        <input
          name="name"
          required
          placeholder="Église La Lumière"
          className="w-full border border-teal/20 rounded-lg px-3 py-2 font-sans text-sm text-dark focus:outline-none focus:border-teal"
        />
      </div>

      <div>
        <label className="block font-sans text-sm text-dark/70 mb-1">Slug (identifiant URL)</label>
        <input
          name="slug"
          required
          placeholder="la-lumiere"
          pattern="[a-z0-9-]+"
          title="Uniquement des lettres minuscules, chiffres et tirets"
          className="w-full border border-teal/20 rounded-lg px-3 py-2 font-sans text-sm text-dark focus:outline-none focus:border-teal"
        />
        <p className="font-sans text-xs text-dark/35 mt-1">Minuscules, chiffres et tirets uniquement</p>
      </div>

      <div>
        <label className="block font-sans text-sm text-dark/70 mb-1">Email de l'administrateur</label>
        <input
          name="admin_email"
          type="email"
          required
          placeholder="admin@eglise.fr"
          className="w-full border border-teal/20 rounded-lg px-3 py-2 font-sans text-sm text-dark focus:outline-none focus:border-teal"
        />
        <p className="font-sans text-xs text-dark/35 mt-1">Un email d'activation lui sera envoyé automatiquement</p>
      </div>

      {error && (
        <p className="font-sans text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="font-sans text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
          Église créée et invitation envoyée.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-teal text-white font-sans text-sm rounded-lg px-4 py-2.5 hover:bg-teal-dark transition-colors disabled:opacity-50"
      >
        {pending ? 'Création en cours…' : 'Créer l\'église'}
      </button>
    </form>
  )
}
