'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { removeAssignmentAsync } from './actions'

/** Bouton « retirer » (×) — appelle l'action directement (pas de <form>/redirect),
 *  feedback immédiat (spinner) puis rafraîchit la vue en arrière-plan. */
export function RemoveAssignmentButton({
  assignmentId,
  planId,
  className,
}: {
  assignmentId: string
  planId: string
  className?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      aria-label="Retirer"
      disabled={isPending}
      onClick={() => startTransition(async () => {
        try {
          const result = await removeAssignmentAsync(assignmentId, planId)
          if (!result.ok) console.error('[RemoveAssignmentButton]', result.error)
        } catch (err) {
          console.error('[RemoveAssignmentButton]', err)
        }
        router.refresh()
      })}
      className={className ?? 'p-1.5 text-dark/20 hover:text-red-400 transition-colors font-sans text-xl leading-none disabled:opacity-40'}
    >
      {isPending ? '…' : '×'}
    </button>
  )
}
