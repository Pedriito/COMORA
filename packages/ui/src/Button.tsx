import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export type ButtonVariant = 'primary' | 'accent' | 'dark' | 'outline' | 'ghost' | 'link'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'
export type ButtonShape = 'rounded' | 'pill'

export type ButtonStyleOptions = {
  /** `primary` teal plein · `accent` coral, pour l'action principale d'un en-tête ·
   *  `dark` sur fond clair chargé · `outline` action secondaire · `ghost` sur fond
   *  sombre ou teinté · `link` texte nu, sans boîte. */
  variant?: ButtonVariant
  size?: ButtonSize
  /** `pill` pour les boutons d'en-tête et les puces ; `rounded` partout ailleurs. */
  shape?: ButtonShape
  fullWidth?: boolean
  className?: string
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-teal text-white hover:bg-teal-dark',
  accent:  'bg-coral text-white hover:bg-coral/90',
  dark:    'bg-dark text-white hover:bg-dark/80',
  outline: 'border border-teal/20 text-dark/60 hover:bg-teal/5',
  ghost:   'bg-white/10 text-white hover:bg-white/20',
  link:    'text-teal hover:underline',
}

const SIZES: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1.5 text-xs',
  sm: 'px-3 py-2 text-xs',
  md: 'px-3.5 py-2.5 text-sm',
  lg: 'px-4 py-3 text-sm',
}

/** La variante `link` n'a ni boîte ni fond : les espacements la décaleraient
 *  du texte qui l'entoure. */
const LINK_SIZES: Record<ButtonSize, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
}

const SHAPES: Record<ButtonShape, string> = {
  rounded: 'rounded-lg',
  pill: 'rounded-full',
}

/** Classes d'un bouton, exposées séparément pour les éléments qui ne sont pas des
 *  `<button>` — typiquement un lien de navigation, que ce paquet ne peut pas rendre
 *  lui-même sans dépendre du routeur de l'application. */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  const isLink = variant === 'link'
  return cx(
    'inline-flex items-center justify-center gap-1.5 font-sans font-medium transition-colors',
    'disabled:opacity-40 disabled:pointer-events-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus-visible:ring-offset-2',
    VARIANTS[variant],
    isLink ? LINK_SIZES[size] : SIZES[size],
    isLink ? '' : SHAPES[shape],
    fullWidth && 'w-full',
    className,
  )
}

export type ButtonProps = ButtonStyleOptions &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
    children?: ReactNode
  }

export function Button({
  variant, size, shape, fullWidth, className, type = 'button', children, ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses({ variant, size, shape, fullWidth, className })} {...rest}>
      {children}
    </button>
  )
}
