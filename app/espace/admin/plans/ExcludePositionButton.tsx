'use client'

import { useState } from 'react'
import { excludePlanPositionAsync } from './actions'

/** Bouton masquer/réafficher un poste.
 *
 *  `onToggle` applique le changement dans l'état local du parent AVANT l'aller-retour serveur.
 *  Raison : le rafraîchissement déclenché par l'action produit bien un nouveau rendu avec la
 *  bonne donnée, mais React abandonne ce rendu sans jamais le committer (constaté en production :
 *  logs de rendu sans log de commit). Une mise à jour issue d'un événement utilisateur dans
 *  l'arbre visible, elle, est toujours appliquée. En cas d'échec serveur, on annule. */
export function ExcludePositionButton({
  planId,
  positionId,
  exclude,
  title,
  className,
  children,
  onToggle,
}: {
  planId: string
  positionId: string
  /** true = masquer ce poste, false = le réafficher */
  exclude: boolean
  title: string
  className: string
  children: React.ReactNode
  onToggle?: (positionId: string, exclude: boolean) => void
}) {
  const [isPending, setIsPending] = useState(false)

  async function handleClick() {
    setIsPending(true)
    onToggle?.(positionId, exclude)
    try {
      const result = await excludePlanPositionAsync(planId, positionId, exclude)
      if (!result.ok) {
        console.error('[ExcludePositionButton]', result.error)
        onToggle?.(positionId, !exclude)
      }
    } catch (err) {
      console.error('[ExcludePositionButton]', err)
      onToggle?.(positionId, !exclude)
    }
    // Pas de `router.refresh()` ici : l'action appelle déjà `refresh()` côté serveur. Deux
    // rafraîchissements concurrents se résolvent dans le désordre et celui qui arrive en dernier
    // peut repeindre un instantané antérieur — c'est ce qui rendait le mobile intermittent.
    setIsPending(false)
  }

  return (
    <button
      type="button"
      title={title}
      disabled={isPending}
      onClick={handleClick}
      className={`${className} disabled:opacity-50`}
    >
      {isPending ? '…' : children}
    </button>
  )
}
