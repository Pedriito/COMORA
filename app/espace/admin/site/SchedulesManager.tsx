'use client'

import { useState, useTransition } from 'react'
import { saveSchedule, deleteSchedule } from './actions'
import type { ChurchSchedule } from '@/lib/churchSettings'

type Props = { initial: ChurchSchedule[] }

const EMPTY: Omit<ChurchSchedule, 'id' | 'active'> = {
  sort_order: 0, day_of_week: '', event_name: '', start_time: '', end_time: '', subtitle: '',
}

export default function SchedulesManager({ initial }: Props) {
  const [schedules, setSchedules] = useState<ChurchSchedule[]>(initial)
  const [editing, setEditing] = useState<string | null>(null) // id ou 'new'
  const [isPending, startTransition] = useTransition()

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await saveSchedule(fd)
      if (res.ok) window.location.reload()
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Supprimer ce créneau ?')) return
    startTransition(async () => {
      await deleteSchedule(id)
      setSchedules(prev => prev.filter(s => s.id !== id))
    })
  }

  const editingSchedule = schedules.find(s => s.id === editing)

  return (
    <div className="space-y-3">
      {schedules.map(s => (
        <div key={s.id} className="bg-white rounded-xl border border-teal/20 px-4 py-3">
          {editing === s.id ? (
            <ScheduleForm
              schedule={s}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
              isPending={isPending}
            />
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-sans text-xs text-teal/70 uppercase tracking-wide">{s.day_of_week}</p>
                <p className="font-sans text-sm font-medium text-dark">{s.event_name}</p>
                <p className="font-sans text-xs text-dark/50">
                  {s.start_time}{s.end_time ? ` – ${s.end_time}` : ''}
                  {s.subtitle ? ` · ${s.subtitle}` : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setEditing(s.id)}
                  className="px-3 py-1.5 rounded-lg border border-teal/20 font-sans text-xs text-dark/60 hover:bg-teal/5"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded-lg border border-red-100 font-sans text-xs text-red-400 hover:bg-red-50"
                >
                  Supprimer
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {editing === 'new' ? (
        <div className="bg-white rounded-xl border border-teal/30 px-4 py-3">
          <ScheduleForm
            schedule={null}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
            isPending={isPending}
          />
        </div>
      ) : (
        <button
          onClick={() => setEditing('new')}
          className="w-full py-2.5 rounded-xl border border-dashed border-teal/30 font-sans text-xs text-dark/40 hover:text-teal hover:border-teal/60 transition-colors"
        >
          + Ajouter un créneau
        </button>
      )}
    </div>
  )
}

function ScheduleForm({
  schedule, onSave, onCancel, isPending,
}: {
  schedule: ChurchSchedule | null
  onSave: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <form onSubmit={onSave} className="space-y-3">
      {schedule && <input type="hidden" name="id" value={schedule.id} />}
      <input type="hidden" name="sort_order" value={schedule?.sort_order ?? 99} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="font-sans text-[11px] text-dark/40">Jour</label>
          <input name="day_of_week" defaultValue={schedule?.day_of_week ?? ''} required
            placeholder="ex: Dimanche"
            className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans focus:outline-none focus:border-teal/50" />
        </div>
        <div className="space-y-1">
          <label className="font-sans text-[11px] text-dark/40">Nom de l'événement</label>
          <input name="event_name" defaultValue={schedule?.event_name ?? ''} required
            placeholder="ex: Culte"
            className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans focus:outline-none focus:border-teal/50" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="font-sans text-[11px] text-dark/40">Heure début</label>
          <input name="start_time" defaultValue={schedule?.start_time ?? ''} required
            placeholder="ex: 10h00"
            className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans focus:outline-none focus:border-teal/50" />
        </div>
        <div className="space-y-1">
          <label className="font-sans text-[11px] text-dark/40">Heure fin</label>
          <input name="end_time" defaultValue={schedule?.end_time ?? ''}
            placeholder="ex: 12h00"
            className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans focus:outline-none focus:border-teal/50" />
        </div>
      </div>
      <div className="space-y-1">
        <label className="font-sans text-[11px] text-dark/40">Sous-titre (optionnel)</label>
        <input name="subtitle" defaultValue={schedule?.subtitle ?? ''}
          placeholder="ex: Accueil dès 9h45"
          className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans focus:outline-none focus:border-teal/50" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-teal/20 font-sans text-xs text-dark/60 hover:bg-teal/5">
          Annuler
        </button>
        <button type="submit" disabled={isPending}
          className="flex-1 py-2 rounded-lg bg-teal text-white font-sans text-xs font-medium hover:bg-teal/90 disabled:opacity-40">
          Enregistrer
        </button>
      </div>
    </form>
  )
}
