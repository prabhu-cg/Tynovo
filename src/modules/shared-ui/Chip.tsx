import type { ReactNode } from 'react'
import { CheckIcon } from './icons'

/** A checkbox that looks like a pill. The tick and the word carry the state; the fill only reinforces it. */
export function Chip({ checked, onChange, children, name }: { checked: boolean; onChange: () => void; children: ReactNode; name?: string }) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong px-3.5 text-sm font-semibold text-ink-strong transition-colors has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent-strong has-focus-visible:outline-2 has-focus-visible:outline-accent md:min-h-9 [&:not(:has(:checked))]:hover:bg-sheet-deep">
      <input type="checkbox" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {checked ? <CheckIcon /> : null}
      {children}
    </label>
  )
}
