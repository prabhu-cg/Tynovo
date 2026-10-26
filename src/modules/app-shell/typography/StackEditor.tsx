import { useId, useState } from 'react'
import { FALLBACK_STACKS, type FontSource } from '@/modules/brand-projects/schema'
import { parseFamilies } from '@/modules/brand-system/ops'
import { inputClass } from '@/modules/shared-ui'

/**
 * Edit the families tried after a font and before the generic one. The text is parsed when you leave the field
 * (or press Enter), so typing "Helvetica Neue, " does not jump around while you type.
 */
export function StackEditor({ label, primary, families, generic, onCommit }: { label: string; primary: string; families: readonly string[]; generic: FontSource['fallback']; onCommit: (stack: { families: string[]; generic: FontSource['fallback'] }) => void }) {
  const id = useId()
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? families.join(', ')
  const parsed = parseFamilies(shown)
  const tooMany = shown.split(/[,\n]/).filter((x) => x.trim()).length > 8
  const commit = () => {
    onCommit({ families: parseFamilies(shown), generic })
    setText(null)
  }
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <label className="grid gap-1 text-sm font-semibold text-ink-strong" htmlFor={id}>
        {label}
        <input id={id} value={shown} placeholder="e.g. Helvetica Neue, Arial" aria-describedby={`${id}-stack`} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit())} className={`${inputClass} font-normal`} />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-ink-strong">
        Then
        <select aria-label={`Generic family for ${primary}`} value={generic} onChange={(e) => onCommit({ families: parseFamilies(shown), generic: e.target.value as FontSource['fallback'] })} className={`${inputClass} font-normal`}>
          {FALLBACK_STACKS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>
      <p id={`${id}-stack`} data-testid="stack-preview" className="tnum text-xs break-words text-ink-soft sm:col-span-2">
        CSS stack: <code>{[primary, ...parsed].map((f) => `"${f}"`).join(', ')}, {generic}</code>{tooMany ? ' (only the first 8 families are kept)' : ''}
      </p>
    </div>
  )
}
