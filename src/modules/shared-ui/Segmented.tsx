import { useId } from 'react'

/** Radio group styled as a segmented control. Arrow keys move between options (native radio behaviour). */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (v: T) => void }) {
  const name = useId()
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 text-sm font-semibold text-ink-strong">{label}</legend>
      <div className="flex overflow-hidden rounded-md border border-line-strong">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 flex-1 cursor-pointer items-center justify-center px-2 text-center text-sm sm:px-3 sm:whitespace-nowrap font-semibold transition-colors has-checked:bg-accent has-checked:text-white has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent md:min-h-9 [&:not(:has(:checked))]:hover:bg-sheet-deep">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
