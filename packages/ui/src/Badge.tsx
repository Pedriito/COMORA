import type { ReactNode } from 'react'
import { cx } from './cx'

export type BadgeTone = 'teal' | 'orange' | 'green' | 'red' | 'amber' | 'neutral'
export type BadgeSize = 'sm' | 'md'

export type BadgeProps = {
  /** `orange` signale une action attendue (« À pourvoir »), `amber` une attente,
   *  `green` un état acquis, `red` un refus. `teal` est l'étiquette neutre de marque. */
  tone?: BadgeTone
  size?: BadgeSize
  className?: string
  children?: ReactNode
}

const TONES: Record<BadgeTone, string> = {
  teal: 'bg-teal/10 text-teal',
  orange: 'bg-orange-100 text-orange-500',
  green: 'bg-green-50 text-green-700',
  red: 'bg-red-50 text-red-400',
  amber: 'bg-amber-50 text-amber-600',
  neutral: 'bg-dark/5 text-dark/50',
}

const SIZES: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-2.5 py-0.5 font-semibold',
  md: 'text-xs px-3 py-1 font-medium',
}

/** Étiquette d'état, arrondie et colorée. */
export function Badge({ tone = 'teal', size = 'sm', className, children }: BadgeProps) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full font-sans shrink-0', TONES[tone], SIZES[size], className)}>
      {children}
    </span>
  )
}
