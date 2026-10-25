import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const base =
  'inline-flex items-center justify-center gap-2 rounded-md px-3.5 min-h-11 md:min-h-9 text-sm font-semibold whitespace-nowrap transition-colors duration-150 disabled:opacity-45 disabled:pointer-events-none cursor-pointer'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong',
  secondary: 'bg-paper text-ink-strong border border-line-strong hover:border-ink hover:bg-sheet',
  ghost: 'text-ink hover:bg-sheet-deep',
  danger: 'bg-danger text-white hover:bg-[#8f1d17]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'secondary', className = '', type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...rest} />
}

/** A router link that looks like a Button, for navigation (use Button for actions). */
export function ButtonLink({ variant = 'secondary', className = '', ...rest }: LinkProps & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...rest} />
}
