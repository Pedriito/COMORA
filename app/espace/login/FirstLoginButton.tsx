'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function FirstLoginButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  function handleClick() {
    setLoading(true)
    router.push('/espace/mot-de-passe-oublie?premier=1')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="block w-full py-3 border border-teal/40 rounded-lg text-teal text-sm font-sans font-medium text-center cursor-pointer hover:bg-teal/5 transition-colors disabled:opacity-60"
    >
      {loading ? 'Chargement…' : 'Première connexion ? Créer mon mot de passe'}
    </button>
  )
}
