'use client'

import { useLinkStatus } from 'next/link'

/** Spinner affiché par-dessus son <Link> parent tant que la navigation est en attente.
 *  Doit être rendu comme enfant (direct ou non) d'un <Link> — le parent a besoin de
 *  `relative` (et idéalement `overflow-hidden`) pour que l'overlay se positionne bien. */
export function LinkPendingSpinner() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span
      aria-hidden
      className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-white/70 backdrop-blur-[1px]"
    >
      <svg className="w-4 h-4 animate-spin text-teal" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </span>
  )
}
