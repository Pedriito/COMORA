'use client'

import './fullcalendar.css'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import frLocale from '@fullcalendar/core/locales/fr'
import type { EventClickArg, DatesSetArg, EventContentArg, EventDropArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { movePlan, copyPlan } from './actions'
import { SubscribeCalendarButton } from './SubscribeCalendarButton'
import { LinkPendingSpinner } from '@/app/espace/_components/LinkPendingSpinner'
import type { PlanItem } from './page'

// ── Palette ───────────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, { main: string; bg: string; text: string; label: string }> = {
  sunday_service: { main: 'var(--color-teal)', bg: 'rgba(90,158,166,0.10)',  text: '#2D6870', label: 'Culte' },
  prayer_meeting: { main: '#8B6FC4', bg: 'rgba(139,111,196,0.10)', text: '#5A4490', label: 'Prière' },
  rehearsal:      { main: '#E08A3C', bg: 'rgba(224,138,60,0.10)',  text: '#8C5218', label: 'Répétition' },
  other:          { main: '#3B82F6', bg: 'rgba(59,130,246,0.10)',  text: '#1D4ED8', label: 'Autre' },
}
function getColor(t: string | null | undefined) {
  return TYPE_COLORS[t ?? ''] ?? TYPE_COLORS.other
}

// ── Vues ──────────────────────────────────────────────────────────────────────
type CalView = 'dayGrid2Month' | 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'
const VIEWS: [CalView, string][] = [
  ['dayGrid2Month', '2 mois'],
  ['dayGridMonth',  'Mois'],
  ['timeGridWeek',  'Semaine'],
  ['timeGridDay',   'Jour'],
]

// ── Pill d'événement ──────────────────────────────────────────────────────────
function EventPill({ arg, selected }: { arg: EventContentArg; selected: boolean }) {
  const c = getColor(arg.event.extendedProps.planType as string | null)
  const time = arg.event.start
    ? arg.event.start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : ''
  return (
    <div
      className="flex items-center gap-1 w-full overflow-hidden px-1.5 py-[3px] rounded-[3px]"
      style={{
        backgroundColor: c.bg,
        borderLeft: `3px solid ${c.main}`,
        outline: selected ? `2px solid color-mix(in srgb, ${c.main} 40%, transparent)` : undefined,
        outlineOffset: '1px',
      }}
    >
      <span className="font-sans text-[10px] font-semibold shrink-0 tabular-nums" style={{ color: c.main }}>
        {time}
      </span>
      <span className="font-sans text-xs truncate font-medium" style={{ color: c.text }}>
        {arg.event.title}
      </span>
    </div>
  )
}

// ── Modale de description (Espace) ────────────────────────────────────────────
function DescriptionModal({ plan, onClose }: { plan: PlanItem; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const c = getColor(plan.plan_type)
  const d = new Date(plan.service_date)
  const dateLabel = d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const timeLabel = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div
      className="fixed inset-0 bg-dark/30 backdrop-blur-[2px] z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6 pb-8 sm:pb-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Poignée mobile */}
        <div className="flex justify-center -mt-2 mb-1 sm:hidden">
          <span className="w-10 h-1 rounded-full bg-dark/15" />
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.main }} />
            <span className="font-sans text-xs font-semibold uppercase tracking-widest" style={{ color: c.main }}>
              {c.label}
            </span>
          </span>
          <button onClick={onClose} className="text-dark/30 hover:text-dark transition-colors text-xl leading-none">×</button>
        </div>
        <div>
          <h2 className="font-display text-2xl text-dark font-light">{plan.title}</h2>
          <p className="font-sans text-sm text-dark/50 capitalize mt-1">{dateLabel} · {timeLabel}</p>
        </div>
        {/* Pas de onClick={onClose} ici : on laisse la modale ouverte (avec son spinner)
            pendant la navigation, elle disparaît naturellement une fois la page changée. */}
        <Link
          href={`/espace/admin/plans/${plan.id}`}
          className="relative flex items-center justify-center w-full py-3 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-85 transition-opacity"
          style={{ backgroundColor: c.main }}
        >
          <LinkPendingSpinner />
          Voir le service →
        </Link>
      </div>
    </div>
  )
}

// ── Section tips ──────────────────────────────────────────────────────────────
function TipsSection() {
  const [open, setOpen] = useState(false)
  const tips: [string, string][] = [
    ['Glisser (vue Mois)',            'Déplacer le service à une autre date'],
    ['Glisser (vue Semaine/Jour)',    'Déplacer la date ET modifier l\'heure'],
    ['Ctrl + Glisser',               'Dupliquer le service à la date cible'],
    ['Clic sur un jour vide',        'Créer un nouveau service'],
    ['Clic sur un service',          'Sélectionner (surligne l\'événement)'],
    ['Espace (service sélectionné)', 'Afficher le résumé du service'],
    ['Échap',                        'Fermer la popup · Désélectionner'],
  ]
  return (
    <div className="mt-4 pt-3 border-t border-dark/6">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 font-sans text-xs text-dark/35 hover:text-dark/55 transition-colors group"
      >
        <span className="w-4 h-4 rounded-full border border-dark/20 flex items-center justify-center text-[9px] font-bold group-hover:border-dark/40">?</span>
        Conseils du calendrier
        <span className={`text-[10px] transition-transform inline-block ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-2">
          {tips.map(([key, desc]) => (
            <div key={key} className="flex items-start gap-2">
              <kbd className="shrink-0 font-sans text-[10px] bg-dark/6 text-dark/50 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                {key}
              </kbd>
              <span className="font-sans text-xs text-dark/45 leading-snug">{desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
type Props = {
  plans: PlanItem[]
  monthParam?: string
  hasCalendarFeed?: boolean
  canManage: boolean
  countByPlan?: Record<string, number>
}

// ── Composant principal ───────────────────────────────────────────────────────
export function PlanCalendar({ plans, hasCalendarFeed = false, canManage, countByPlan = {} }: Props) {
  const calRef = useRef<FullCalendar>(null)
  const ctrlHeld = useRef(false)
  const router = useRouter()

  const [currentView, setCurrentView] = useState<CalView>('dayGridMonth')
  const [calTitle, setCalTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const selectedPlan = plans.find(p => p.id === selectedPlanId) ?? null

  // Ctrl key + raccourcis clavier
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') ctrlHeld.current = true
      if (e.key === ' ' && selectedPlanId) { e.preventDefault(); setShowModal(true) }
      if (e.key === 'Escape') { setShowModal(false); setSelectedPlanId(null) }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') ctrlHeld.current = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [selectedPlanId])

  // Événements FullCalendar
  const fcEvents = useMemo(() => plans.map(p => ({
    id: p.id,
    title: p.title,
    start: p.service_date,
    end: new Date(new Date(p.service_date).getTime() + 3_600_000).toISOString(),
    extendedProps: { planType: p.plan_type, count: countByPlan[p.id] ?? 0 },
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    textColor: 'inherit',
  })), [plans, countByPlan])

  const api = () => calRef.current?.getApi()

  const switchView = useCallback((v: CalView) => {
    setCurrentView(v)
    api()?.changeView(v)
  }, [])

  const onDatesSet = useCallback((arg: DatesSetArg) => {
    const raw = arg.view.title
    setCalTitle(raw.charAt(0).toUpperCase() + raw.slice(1))
  }, [])

  const onEventDrop = useCallback(async (arg: EventDropArg) => {
    const planId = arg.event.id
    setError(null)

    // En vue Semaine/Jour : l'heure peut être modifiée par drag
    // En vue Mois/2 mois : seule la date change, l'heure d'origine est préservée
    const isTimeGrid = currentView.startsWith('timeGrid')
    let newServiceDate: string
    if (isTimeGrid && arg.event.startStr.includes('T')) {
      newServiceDate = arg.event.startStr.slice(0, 16)
    } else {
      const origTime = arg.oldEvent.startStr.includes('T')
        ? arg.oldEvent.startStr.split('T')[1].slice(0, 5)
        : '10:00'
      newServiceDate = `${arg.event.startStr.split('T')[0]}T${origTime}`
    }

    if (ctrlHeld.current) {
      // Ctrl+glisser → copier
      arg.revert()
      const res = await copyPlan(planId, newServiceDate)
      if (!res.ok) setError(res.error ?? 'Échec de la copie.')
      else router.refresh()
    } else {
      // Glisser → déplacer
      const res = await movePlan(planId, newServiceDate)
      if (!res.ok) { arg.revert(); setError(res.error ?? 'Échec du déplacement.') }
      else router.refresh()
    }
  }, [currentView, router])

  const onDateClick = useCallback((arg: DateClickArg) => {
    if (!canManage) return
    router.push(`/espace/admin/plans/nouveau?date=${arg.dateStr.split('T')[0]}`)
  }, [canManage, router])

  const onEventClick = useCallback((arg: EventClickArg) => {
    arg.jsEvent.preventDefault()
    const id = arg.event.id
    setSelectedPlanId(id)
    setShowModal(true)
  }, [])

  const renderEvent = useCallback((arg: EventContentArg) => (
    <EventPill arg={arg} selected={arg.event.id === selectedPlanId} />
  ), [selectedPlanId])

  // ── Données sidebar ───────────────────────────────────────────────────────
  const { upcoming, thisMonthCount, thisWeek, later, featuredId, monthEnd, monthName } = useMemo(() => {
    const now = new Date()
    const dow = now.getDay() === 0 ? 6 : now.getDay() - 1
    const wStart = new Date(now); wStart.setDate(now.getDate() - dow); wStart.setHours(0, 0, 0, 0)
    const wEnd   = new Date(wStart); wEnd.setDate(wStart.getDate() + 6); wEnd.setHours(23, 59, 59, 999)

    const upcoming = [...plans]
      .filter(p => new Date(p.service_date) >= now)
      .sort((a, b) => a.service_date.localeCompare(b.service_date))

    const thisMonthCount = upcoming.filter(p => {
      const d = new Date(p.service_date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length

    const thisWeek = upcoming.filter(p => { const d = new Date(p.service_date); return d >= wStart && d <= wEnd })
    const later    = upcoming.filter(p => new Date(p.service_date) > wEnd).slice(0, 8)
    const featuredId = thisWeek[0]?.id

    const monthEnd  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const monthName = now.toLocaleDateString('fr-FR', { month: 'long' })

    return { upcoming, thisMonthCount, thisWeek, later, featuredId, monthEnd, monthName }
  }, [plans])

  function fmtDate(p: PlanItem, long = false) {
    return new Date(p.service_date).toLocaleDateString('fr-FR',
      long ? { weekday: 'short', day: 'numeric', month: 'short' }
           : { weekday: 'short', day: 'numeric' })
  }
  function fmtTime(p: PlanItem) {
    return new Date(p.service_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {showModal && selectedPlan && (
        <DescriptionModal plan={selectedPlan} onClose={() => { setShowModal(false); setSelectedPlanId(null) }} />
      )}

      <div className="flex gap-5">
        {/* ── Calendrier ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* En-tête personnalisé */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center">
              <button
                onClick={() => api()?.prev()}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dark/5 transition-colors text-dark/45 text-xl font-light"
              >‹</button>
              <button
                onClick={() => api()?.next()}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dark/5 transition-colors text-dark/45 text-xl font-light"
              >›</button>
            </div>

            <h2 className="font-display text-2xl text-dark font-light min-w-44 capitalize">{calTitle}</h2>

            <button
              onClick={() => api()?.today()}
              className="px-3 py-1 rounded-full border border-dark/15 font-sans text-xs text-dark/55 hover:bg-dark/5 transition-colors"
            >
              Aujourd'hui
            </button>

            {/* Légende types */}
            <div className="hidden md:flex items-center gap-4 ml-1">
              {Object.entries(TYPE_COLORS).map(([k, c]) => (
                <span key={k} className="flex items-center gap-1.5 font-sans text-xs text-dark/55">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.main }} />
                  {c.label}
                </span>
              ))}
            </div>

            {/* Switcher de vues */}
            <div className="ml-auto flex bg-dark/6 rounded-lg p-0.5 gap-0">
              {VIEWS.map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => switchView(v)}
                  className={`px-3 py-1.5 rounded-md font-sans text-xs font-medium transition-colors ${
                    currentView === v ? 'bg-white text-dark shadow-sm' : 'text-dark/40 hover:text-dark'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <SubscribeCalendarButton hasFeed={hasCalendarFeed} />
          </div>

          {/* Indice drag */}
          {canManage && (
            <p className="font-sans text-xs text-dark/35 flex items-center gap-1.5 -mt-1 flex-wrap">
              <span className="text-dark/25">↺</span>
              Glissez pour replanifier.
              <span className="text-dark/20">En vue Semaine/Jour, l'heure est aussi modifiable.</span>
              <span className="text-dark/20">Ctrl + glisser pour dupliquer.</span>
            </p>
          )}

          {error && (
            <div className="font-sans text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* FullCalendar */}
          <div className="fc-comora bg-white rounded-2xl border border-dark/8 shadow-sm overflow-hidden">
            <FullCalendar
              ref={calRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              locale={frLocale}
              firstDay={1}
              initialView="dayGridMonth"
              headerToolbar={false}
              views={{
                dayGrid2Month: { type: 'dayGrid', duration: { months: 2 } },
              }}
              events={fcEvents}
              editable={canManage}
              droppable={false}
              eventDrop={onEventDrop}
              eventResizableFromStart={false}
              eventDurationEditable={false}
              dateClick={canManage ? onDateClick : undefined}
              eventClick={onEventClick}
              eventContent={renderEvent}
              datesSet={onDatesSet}
              height="auto"
              dayMaxEvents={4}
              moreLinkText={(n) => `+${n} autres`}
              nowIndicator
            />
          </div>

          {canManage && <TipsSection />}
        </div>

        {/* ── Agenda latéral ─────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col w-60 xl:w-64 shrink-0 gap-5 pt-12">

          {/* CE MOIS */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="font-sans text-[10px] font-semibold uppercase tracking-widest text-dark/35">Ce mois</p>
              <span className="min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-teal-dark text-white font-sans text-[11px] font-semibold px-1.5">
                {thisMonthCount}
              </span>
            </div>
            <p className="font-sans text-sm text-dark/40">Du 1ᵉʳ au {monthEnd} {monthName}</p>
          </div>

          {/* CETTE SEMAINE */}
          {thisWeek.length > 0 && (
            <div>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-widest text-dark/35 mb-2">Cette semaine</p>
              <div className="space-y-2">
                {thisWeek.map(p => {
                  const c = getColor(p.plan_type)
                  const n = countByPlan[p.id] ?? 0
                  if (p.id === featuredId) {
                    return (
                      <Link
                        key={p.id}
                        href={`/espace/admin/plans/${p.id}`}
                        className="relative block rounded-xl border p-3 hover:opacity-90 transition-opacity"
                        style={{ borderColor: `color-mix(in srgb, ${c.main} 33%, transparent)`, backgroundColor: c.bg }}
                      >
                        <LinkPendingSpinner />
                        <p className="font-sans text-sm font-semibold text-dark truncate">{p.title}</p>
                        <p className="font-sans text-xs text-dark/50 mt-0.5 capitalize">
                          {fmtDate(p)} · {fmtTime(p)}{n > 0 ? ` · ${n}` : ''}
                        </p>
                      </Link>
                    )
                  }
                  return (
                    <Link
                      key={p.id}
                      href={`/espace/admin/plans/${p.id}`}
                      className="flex items-start gap-2.5 py-0.5 hover:opacity-70 transition-opacity"
                    >
                      <span className="w-0.5 self-stretch rounded-full shrink-0 mt-0.5" style={{ backgroundColor: c.main }} />
                      <div className="min-w-0">
                        <p className="font-sans text-sm font-semibold text-dark truncate">{p.title}</p>
                        <p className="font-sans text-xs text-dark/45 capitalize">{fmtDate(p)} · {fmtTime(p)}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* PLUS TARD */}
          {later.length > 0 && (
            <div>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-widest text-dark/35 mb-2">Plus tard</p>
              <div className="space-y-2">
                {later.map(p => {
                  const c = getColor(p.plan_type)
                  return (
                    <Link
                      key={p.id}
                      href={`/espace/admin/plans/${p.id}`}
                      className="flex items-center gap-2.5 py-0.5 hover:opacity-70 transition-opacity"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.main }} />
                      <div className="min-w-0">
                        <p className="font-sans text-sm font-medium text-dark truncate">{p.title}</p>
                        <p className="font-sans text-xs text-dark/40 capitalize">{fmtDate(p, true)} · {fmtTime(p)}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {thisWeek.length === 0 && later.length === 0 && (
            <p className="font-sans text-xs text-dark/30 italic">Aucun service à venir.</p>
          )}
        </div>
      </div>
    </>
  )
}
