'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { PlanCalendar as PlanCalendarType } from './PlanCalendar'

const PlanCalendar = dynamic(
  () => import('./PlanCalendar').then(m => m.PlanCalendar),
  { ssr: false, loading: () => <div className="h-96 flex items-center justify-center text-dark/30 font-sans text-sm">Chargement du calendrier…</div> }
)

export function PlanCalendarLazy(props: ComponentProps<typeof PlanCalendarType>) {
  return <PlanCalendar {...props} />
}
