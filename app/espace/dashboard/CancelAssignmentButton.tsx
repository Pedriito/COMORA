'use client'

import { useState } from 'react'
import { cancelAssignment } from '../admin/plans/actions'

export function CancelAssignmentButton({ assignmentId }: { assignmentId: string }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-sans text-xs text-dark/50">Se désister ?</span>
        <form action={cancelAssignment}>
          <input type="hidden" name="assignment_id" value={assignmentId} />
          <button
            type="submit"
            className="text-xs text-red-500 hover:text-red-600 font-sans font-medium transition-colors"
          >
            Confirmer
          </button>
        </form>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-dark/40 hover:text-dark font-sans transition-colors"
        >
          Annuler
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-dark/30 hover:text-red-400 font-sans transition-colors"
    >
      Se désister
    </button>
  )
}
