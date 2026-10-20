import type { ReactNode } from 'react'
import { cx } from './cx'

export type EmptyStateProps = {
  /** `inline` pour une ligne glissée dans une liste, `block` pour une carte
   *  entière laissée vide. */
  variant?: 'inline' | 'block'
  className?: string
  children?: ReactNode
}

/** Message « Aucun… ». Les 59 occurrences relevées divergeaient sur trois axes à
 *  la fois — taille, opacité, italique — pour dire la même chose. */
export function EmptyState({ variant = 'inline', className, children }: EmptyStateProps) {
  if (variant === 'block') {
    return (
      <div className={cx('px-6 py-10 text-center', className)}>
        <p className="font-sans text-sm text-dark/40">{children}</p>
      </div>
    )
  }
  return <p className={cx('font-sans text-xs text-dark/40 italic', className)}>{children}</p>
}
