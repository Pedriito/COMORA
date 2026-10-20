import type { ReactNode } from 'react'
import { cx } from './cx'

export type SectionHeaderSize = 'sm' | 'md'
export type SectionHeaderTone = 'default' | 'onDark'

export type SectionHeaderProps = {
  /** `sm` : 10px semi-gras, la variante dominante. `md` : 12px médium, utilisée
   *  pour les en-têtes de section plus larges et les en-têtes de tableau. */
  size?: SectionHeaderSize
  /** `onDark` pour la barre latérale et les cartes sur fond sombre. */
  tone?: SectionHeaderTone
  className?: string
  children?: ReactNode
}

const SIZES: Record<SectionHeaderSize, string> = {
  sm: 'text-[10px] font-semibold',
  md: 'text-xs font-medium',
}

const TONES: Record<SectionHeaderTone, string> = {
  default: 'text-dark/40',
  onDark: 'text-white/30',
}

/** Intitulé de section en majuscules espacées — le repère de hiérarchie de l'interface. */
export function SectionHeader({ size = 'sm', tone = 'default', className, children }: SectionHeaderProps) {
  return (
    <p className={cx('font-sans uppercase tracking-widest', SIZES[size], TONES[tone], className)}>
      {children}
    </p>
  )
}
