'use client'

import { useState, useTransition } from 'react'
import { setPlanTeams } from '../actions'

type Team = { id: string; name: string }

type Props = {
  planId: string
  teams: Team[]           // toutes les équipes disponibles
  currentTeamIds: string[] | null  // équipes actuellement sélectionnées (null = toutes)
}

export function PlanTeamsManager({ planId, teams, currentTeamIds }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(currentTeamIds ?? [])
  )
  const [isPending, startTransition] = useTransition()

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSave() {
    const fd = new FormData()
    fd.set('plan_id', planId)
    for (const id of selected) fd.append('team_ids[]', id)
    startTransition(async () => {
      await setPlanTeams(fd)
      setOpen(false)
    })
  }

  if (!open) {
    const label = currentTeamIds && currentTeamIds.length > 0
      ? `${currentTeamIds.length} équipe${currentTeamIds.length > 1 ? 's' : ''}`
      : 'Toutes les équipes'
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 font-sans text-xs text-white/70 hover:text-white transition-colors"
      >
        <span className="opacity-60">Équipes :</span>
        <span className="font-semibold underline decoration-dotted underline-offset-2">{label}</span>
        <span className="opacity-50">✎</span>
      </button>
    )
  }

  return (
    <div className="bg-white/10 rounded-xl p-3 space-y-2.5">
      <p className="font-sans text-[10px] text-white/60 uppercase tracking-widest">
        Équipes incluses dans ce service
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {teams.map(t => (
          <label
            key={t.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              selected.has(t.id)
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(t.id)}
              onChange={() => toggle(t.id)}
              className="w-3.5 h-3.5 rounded accent-white shrink-0"
            />
            <span className="font-sans text-xs truncate">{t.name}</span>
          </label>
        ))}
      </div>
      <p className="font-sans text-[10px] text-white/40">
        {selected.size === 0 ? 'Aucune sélection → toutes les équipes seront affichées' : ''}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex-1 py-1.5 rounded-lg bg-white text-teal-dark font-sans text-xs font-semibold disabled:opacity-50 transition-opacity"
        >
          {isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setSelected(new Set(currentTeamIds ?? [])) }}
          className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 font-sans text-xs hover:bg-white/20 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
