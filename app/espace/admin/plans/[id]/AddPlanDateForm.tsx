'use client'

import { useState } from 'react'
import { duplicatePlanToDate } from '../actions'

function pad(n: number) { return String(n).padStart(2, '0') }

function defaultDateTime(serviceDate: string) {
  // Propose la même heure, 7 jours plus tard
  const d = new Date(serviceDate)
  d.setDate(d.getDate() + 7)
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Props = {
  planId: string
  currentServiceDate: string
}

export function AddPlanDateForm({ planId, currentServiceDate }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-sans text-xs text-white/60 hover:text-white/90 transition-colors underline underline-offset-2 decoration-white/30"
        >
          + Planifier une autre date
        </button>
      ) : (
        <form action={duplicatePlanToDate} className="flex items-center gap-2 flex-wrap">
          <input type="hidden" name="from_plan_id" value={planId} />
          <input
            name="service_date"
            type="datetime-local"
            required
            defaultValue={defaultDateTime(currentServiceDate)}
            className="px-3 py-1.5 rounded-lg border border-white/30 bg-white/10 text-white font-sans text-xs focus:outline-none focus:border-white/60 placeholder:text-white/30"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white font-sans text-xs font-semibold rounded-lg transition-colors"
          >
            Créer →
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-white/40 hover:text-white/70 font-sans text-xs transition-colors"
          >
            Annuler
          </button>
        </form>
      )}
    </div>
  )
}
