import type { ReactNode } from 'react'
import { cx } from './cx'

export type CardVariant = 'bordered' | 'elevated'
export type CardPadding = 'none' | 'sm' | 'md'

export type CardProps = {
  /** `bordered` : bordure teal, le traitement dominant de l'application.
   *  `elevated` : ombre légère sans bordure, pour les cartes posées sur un fond teinté. */
  variant?: CardVariant
  /** `none` par défaut : beaucoup de cartes contiennent leurs propres sections
   *  bordées et gèrent donc leur espacement interne elles-mêmes. */
  padding?: CardPadding
  className?: string
  children?: ReactNode
}

const VARIANTS: Record<CardVariant, string> = {
  bordered: 'border border-teal/20',
  elevated: 'shadow-[0_1px_4px_rgba(0,0,0,0.06)]',
}

const PADDINGS: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
}

/** Surface blanche arrondie — le conteneur de base de l'interface. */
export function Card({ variant = 'bordered', padding = 'none', className, children }: CardProps) {
  return (
    <div className={cx('bg-white rounded-2xl overflow-hidden', VARIANTS[variant], PADDINGS[padding], className)}>
      {children}
    </div>
  )
}
