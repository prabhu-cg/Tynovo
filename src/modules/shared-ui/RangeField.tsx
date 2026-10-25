import { useId } from 'react'

/**
 * Labelled slider with a visible value. Native range input, so keyboard (arrows, Home/End, PageUp/Down)
 * and touch work without extra code. `format` controls how the value reads.
 */
export function RangeField({ label, value, min, max, step, onChange, hint, format, defaultValue }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; hint?: string | undefined; format?: (v: number) => string; defaultValue?: number | undefined }) {
  const id = useId()
  const shown = format ? format(value) : String(value)
  const changed = defaultValue !== undefined && defaultValue !== value
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-ink-strong">{label}</label>
        <output htmlFor={id} className={`tnum text-sm ${changed ? 'font-semibold text-accent-strong' : 'text-ink-soft'}`}>{shown}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={shown}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full cursor-pointer accent-accent md:h-5"
      />
      {hint ? <p id={`${id}-hint`} className="text-xs text-ink-soft">{hint}</p> : null}
    </div>
  )
}
