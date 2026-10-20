'use client'

import dynamic from 'next/dynamic'
import type { PlanItem } from './page'

const PlanCalendarLazy = dynamic(
  () => import('./PlanCalendar').then(m => ({ default: m.PlanCalendar })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20 text-dark/30 font-sans text-sm">
        Chargement du calendrier…
      </div>
    ),
  }
)

type Props = {
  plans: PlanItem[]
  monthParam?: string
  icalUrl: string
  canManage: boolean
  countByPlan?: Record<string, number>
}

export function PlanCalendarClient(props: Props) {
  return <PlanCalendarLazy {...props} />
}
