'use client'

import { useState } from 'react'

/** Carte d'équipe repliable (mobile) : repliée par défaut si le viewer n'a pas
 *  d'affectation dans cette équipe pour ce service, pour alléger l'affichage. */
export function MobileTeamBlock({
  defaultExpanded,
  header,
  children,
}: {
  defaultExpanded: boolean
  header: React.ReactNode
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 border-b border-teal/10 flex items-center justify-between gap-2 text-left"
      >
        {header}
        <svg
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className={`w-3 h-3 text-dark/30 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {expanded && <div className="p-3 space-y-2">{children}</div>}
    </div>
  )
}
