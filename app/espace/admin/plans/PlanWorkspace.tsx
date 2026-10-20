'use client'

import { useState } from 'react'
import { AssignmentBoard } from './AssignmentBoard'
import { VolunteerPicker } from './VolunteerPicker'
import type { PlanDetail } from './getPlanDetail'

type Props = {
  planId: string
  detail: PlanDetail
  userId: string
  isAdmin: boolean
  flashError?: string
  flashSent?: string
  returnTo: string
  initialFillKey?: string | null
}

/** Regroupe AssignmentBoard + VolunteerPicker et pilote localement quel poste est
 *  « ouvert » pour affectation — plus besoin d'un aller-retour serveur (`?fill=`) pour
 *  ouvrir/fermer le panneau, puisque VolunteerPicker ne lit que `detail`, déjà en mémoire. */
export function PlanWorkspace({ planId, detail, userId, isAdmin, flashError, flashSent, returnTo, initialFillKey }: Props) {
  const [fillKey, setFillKey] = useState<string | null>(initialFillKey ?? null)

  return (
    <>
      <AssignmentBoard
        planId={planId}
        detail={detail}
        userId={userId}
        fillKey={fillKey}
        isAdmin={isAdmin}
        flashError={flashError}
        flashSent={flashSent}
        returnTo={returnTo}
        onSlotClick={(key) => setFillKey(prev => (prev === key ? null : key))}
      />
      <VolunteerPicker
        planId={planId}
        detail={detail}
        fillKey={fillKey}
        onClose={() => setFillKey(null)}
      />
    </>
  )
}
