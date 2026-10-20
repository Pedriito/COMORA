'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createPlanUnified } from './actions'

type Team = { id: string; name: string }

const TYPE_COLORS: Record<string, string> = {
  sunday_service: 'var(--color-teal)',
  prayer_meeting: '#8B6FC4',
  rehearsal:      '#E08A3C',
}

const TYPES = {
  sunday_service: { label: 'Culte',      defaultTitle: 'Culte du dimanche',  dow: 0, h: 10, m: 0  },
  prayer_meeting: { label: 'Prière',     defaultTitle: 'Réunion de prière',  dow: 2, h: 20, m: 30 },
  rehearsal:      { label: 'Répétition', defaultTitle: 'Répétition Louange', dow: 6, h: 10, m: 0  },
} as const

type PlanType = keyof typeof TYPES

function pad(n: number) { return String(n).padStart(2, '0') }

function toDatetimeLocal(date: Date, h: number, m: number) {
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}`
}

function nextWeekday(dow: number) {
  const today = new Date()
  const diff = ((dow - today.getDay() + 7) % 7) || 7
  const d = new Date(today)
  d.setDate(today.getDate() + diff)
  return d
}

function defaultDate(t: PlanType) {
  const cfg = TYPES[t]
  return toDatetimeLocal(nextWeekday(cfg.dow), cfg.h, cfg.m)
}

function formatDateLabel(dt: string) {
  const d = new Date(dt)
  return (
    d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' · ' + dt.split('T')[1]
  )
}

export function NouveauPlanForm({ teams, error }: { teams: Team[]; error?: string }) {
  const [planType,   setPlanType]   = useState<PlanType>('sunday_service')
  const [title,      setTitle]      = useState<string>(TYPES.sunday_service.defaultTitle)
  const [dateMode,   setDateMode]   = useState<'single' | 'multi'>('single')
  const [singleDate, setSingleDate] = useState(defaultDate('sunday_service'))
  const [dates,      setDates]      = useState<string[]>([])
  const [newDate,    setNewDate]    = useState('')
  const [recurStart, setRecurStart] = useState(defaultDate('sunday_service'))
  const [recurCount, setRecurCount] = useState(4)

  function handleTypeChange(t: PlanType) {
    setPlanType(t)
    setTitle(TYPES[t].defaultTitle)
    setSingleDate(defaultDate(t))
    setRecurStart(defaultDate(t))
  }

  function switchDateMode(mode: 'single' | 'multi') {
    setDateMode(mode)
    // Réinitialise les dates accumulées quand on repasse en mode unique
    // pour éviter de créer plusieurs plans par accident
    if (mode === 'single') setDates([])
  }

  function addDate() {
    if (!newDate || dates.includes(newDate)) return
    setDates(prev => [...prev, newDate].sort())
    setNewDate('')
  }

  function removeDate(d: string) {
    setDates(prev => prev.filter(x => x !== d))
  }

  function generateDates() {
    if (!recurStart) return
    const start = new Date(recurStart)
    const generated: string[] = []
    for (let i = 0; i < recurCount; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i * 7)
      generated.push(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${recurStart.split('T')[1]}`)
    }
    setDates(prev => [...new Set([...prev, ...generated])].sort())
  }

  const accentColor = TYPE_COLORS[planType]
  const isMulti = dateMode === 'multi'
  const canSubmit = isMulti ? dates.length > 0 : !!singleDate

  return (
    <div className="min-h-screen bg-sand">

      <div className="max-w-lg mx-auto px-4 md:px-6 pt-6 pb-0">
        <Link
          href="/espace/admin/plans"
          className="inline-flex items-center gap-1 font-sans text-xs text-dark/40 hover:text-dark transition-colors mb-4"
        >
          ← Planification
        </Link>
        <h1 className="font-display text-3xl text-dark font-light">Nouveau service</h1>
      </div>

      <main className="max-w-lg mx-auto px-4 md:px-6 py-6 space-y-4">

        {/* Type pills */}
        <div className="flex gap-2">
          {(Object.keys(TYPES) as PlanType[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeChange(t)}
              className="flex-1 py-2 px-3 rounded-full font-sans text-sm font-medium transition-all border"
              style={planType === t
                ? { borderColor: TYPE_COLORS[t], color: TYPE_COLORS[t], backgroundColor: 'white' }
                : { borderColor: 'rgba(28,43,45,0.12)', color: 'rgba(28,43,45,0.40)', backgroundColor: 'white' }
              }
            >
              {TYPES[t].label}
            </button>
          ))}
        </div>

        {/* Un seul form avec action unifiée + champ date_mode */}
        <form action={createPlanUnified} className="space-y-4">
          <input type="hidden" name="plan_type"  value={planType} />
          {/* date_mode est lu par createPlanUnified pour savoir quelle branche prendre */}
          <input type="hidden" name="date_mode"  value={isMulti ? 'multi' : 'single'} />

          <div className="bg-white rounded-2xl border border-dark/8 shadow-sm p-5 space-y-5">

            {/* Titre */}
            <div>
              <label className="block font-sans text-[10px] text-dark/40 uppercase tracking-widest mb-1.5">Titre</label>
              <input
                name="title"
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-dark/10 bg-sand text-dark focus:outline-none focus:ring-2 focus:ring-teal/20 font-sans text-sm"
              />
            </div>

            {/* Date mode + inputs */}
            <div>
              <label className="block font-sans text-[10px] text-dark/40 uppercase tracking-widest mb-1.5">Date(s)</label>

              {/* Toggle */}
              <div className="flex rounded-xl overflow-hidden border border-dark/10 mb-3">
                {(['single', 'multi'] as const).map((mode, i) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => switchDateMode(mode)}
                    className={`flex-1 py-2 font-sans text-xs font-medium transition-colors ${
                      dateMode === mode ? 'bg-dark text-white' : 'bg-white text-dark/40 hover:text-dark'
                    } ${i > 0 ? 'border-l border-dark/10' : ''}`}
                  >
                    {mode === 'single' ? 'Une date' : 'Plusieurs dates'}
                  </button>
                ))}
              </div>

              {/* Champ date unique */}
              {!isMulti && (
                <input
                  name="service_date"
                  type="datetime-local"
                  required
                  value={singleDate}
                  onChange={e => setSingleDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-dark/10 bg-sand text-dark focus:outline-none focus:ring-2 focus:ring-teal/20 font-sans text-sm"
                />
              )}

              {/* Multi-dates */}
              {isMulti && (
                <div className="space-y-3">

                  {/* Ajouter une date manuellement */}
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-dark/10 bg-sand text-dark font-sans text-sm focus:outline-none focus:ring-2 focus:ring-teal/20"
                    />
                    <button
                      type="button"
                      onClick={addDate}
                      disabled={!newDate}
                      className="shrink-0 px-4 py-2 rounded-xl border font-sans text-sm font-medium transition-colors hover:bg-coral/5 disabled:opacity-40"
                      style={{ borderColor: 'var(--color-coral)', color: 'var(--color-coral)' }}
                    >
                      + Ajouter
                    </button>
                  </div>

                  {/* Générateur de récurrence */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 border-t border-dashed border-dark/15" />
                    <span className="font-sans text-[9px] text-dark/30 uppercase tracking-widest shrink-0">ou générer chaque semaine</span>
                    <div className="flex-1 border-t border-dashed border-dark/15" />
                  </div>

                  <div className="flex gap-2 items-center">
                    <input
                      type="datetime-local"
                      value={recurStart}
                      onChange={e => setRecurStart(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-dark/10 bg-sand text-dark font-sans text-sm focus:outline-none focus:ring-2 focus:ring-teal/20"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={52}
                        value={recurCount}
                        onChange={e => setRecurCount(Math.max(1, Number(e.target.value)))}
                        className="w-14 px-2 py-2 rounded-xl border border-dark/10 bg-sand text-dark font-sans text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 text-center"
                      />
                      <span className="font-sans text-xs text-dark/40 whitespace-nowrap">sem.</span>
                    </div>
                    <button
                      type="button"
                      onClick={generateDates}
                      className="shrink-0 px-3 py-2 rounded-xl border border-dark/10 bg-white font-sans text-sm text-dark/60 hover:text-dark transition-colors"
                    >
                      Générer ↺
                    </button>
                  </div>

                  {/* Hidden inputs pour chaque date sélectionnée */}
                  {dates.map(d => (
                    <input key={d} type="hidden" name="service_dates" value={d} />
                  ))}

                  {/* Liste des dates */}
                  {dates.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-dark/15 py-8 text-center">
                      <p className="font-sans text-xs text-dark/30">Aucune date ajoutée</p>
                      <p className="font-sans text-[10px] text-dark/20 mt-1">Ajoutez des dates une par une ou générez une série</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dark/8 overflow-hidden">
                      {dates.map((d, i) => (
                        <div
                          key={d}
                          className={`flex items-center gap-3 px-4 py-2.5 ${i < dates.length - 1 ? 'border-b border-dark/6' : ''}`}
                        >
                          <span className="flex-1 font-sans text-sm text-dark">{formatDateLabel(d)}</span>
                          <button
                            type="button"
                            onClick={() => removeDate(d)}
                            className="text-dark/25 hover:text-red-400 transition-colors text-xl leading-none shrink-0"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Équipes */}
            <div>
              <label className="block font-sans text-[10px] text-dark/40 uppercase tracking-widest mb-1.5">
                Équipes <span className="normal-case">(laisser vide = toutes)</span>
              </label>
              <div className="rounded-xl border border-dark/10 overflow-hidden divide-y divide-dark/6">
                {teams.map(t => (
                  <label key={t.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-teal/5 transition-colors">
                    <input
                      type="checkbox"
                      name="team_ids[]"
                      value={t.id}
                      className="w-4 h-4 rounded accent-teal shrink-0"
                    />
                    <span className="font-sans text-sm text-dark">{t.name}</span>
                  </label>
                ))}
              </div>
              <p className="font-sans text-[10px] text-dark/35 mt-1.5 px-1">
                Si aucune équipe sélectionnée, toutes seront incluses.
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block font-sans text-[10px] text-dark/40 uppercase tracking-widest mb-1.5">
                Notes <span className="normal-case">(optionnel)</span>
              </label>
              <textarea
                name="notes"
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-dark/10 bg-sand text-dark placeholder:text-dark/25 focus:outline-none focus:ring-2 focus:ring-teal/20 font-sans text-sm resize-none"
                placeholder="Thème, instructions particulières…"
              />
            </div>
          </div>

          {/* Récapitulatif multi-dates */}
          {isMulti && dates.length > 0 && (
            <div
              className="rounded-2xl px-5 py-3 text-center"
              style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 9%, transparent)` }}
            >
              <p className="font-sans text-sm font-medium" style={{ color: accentColor }}>
                {dates.length} service{dates.length > 1 ? 's' : ''} «&nbsp;{title}&nbsp;» seront créés
              </p>
            </div>
          )}

          {error && (
            <p className="font-sans text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3.5 rounded-2xl font-sans text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: accentColor }}
          >
            {isMulti
              ? dates.length === 0
                ? 'Ajoutez des dates pour continuer'
                : `Créer ${dates.length} service${dates.length > 1 ? 's' : ''}`
              : planType === 'rehearsal'
                ? 'Créer la répétition'
                : 'Créer le service'
            }
          </button>
        </form>
      </main>
    </div>
  )
}
