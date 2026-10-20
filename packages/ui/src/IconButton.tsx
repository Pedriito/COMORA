import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export type IconButtonSize = 'sm' | 'md' | 'lg'
export type IconButtonTone = 'default' | 'danger' | 'onDark'

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  size?: IconButtonSize
  /** `danger` pour les actions destructrices (retirer, supprimer). */
  tone?: IconButtonTone
  className?: string
  /** Obligatoire : un bouton sans texte visible doit s'annoncer aux lecteurs d'écran. */
  'aria-label': string
  children?: ReactNode
}

const SIZES: Record<IconButtonSize, string> = {
  sm: 'w-7 h-7 text-sm',
  md: 'w-9 h-9 text-base',
  lg: 'w-10 h-10 text-lg',
}

const TONES: Record<IconButtonTone, string> = {
  default: 'text-dark/30 hover:text-dark/60',
  danger: 'text-dark/25 hover:text-red-400',
  onDark: 'text-white/60 hover:text-white',
}

/** Bouton ne contenant qu'une icône ou un symbole. */
export function IconButton({
  size = 'md', tone = 'default', className, type = 'button', children, ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center rounded-full shrink-0 leading-none transition-colors',
        'disabled:opacity-40 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40',
        SIZES[size],
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export type CloseButtonProps = Omit<IconButtonProps, 'children' | 'aria-label'> & {
  'aria-label'?: string
}

/** Fermeture d'une modale, d'un panneau ou d'un champ déplié. */
export function CloseButton({ 'aria-label': ariaLabel = 'Fermer', ...rest }: CloseButtonProps = {}) {
  return (
    <IconButton aria-label={ariaLabel} {...rest}>
      <span aria-hidden="true">×</span>
    </IconButton>
  )
}
