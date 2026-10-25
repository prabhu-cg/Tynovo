import { useId, useState } from 'react'
import { inputClass } from './fields'

/**
 * Number input that lets you type freely ("1." on the way to "1.25") and only commits values in range.
 * When you leave the field it snaps back to the committed value.
 */
export function NumberField({ label, value, min, max, step = 1, onCommit }: { label: string; value: number; min: number; max: number; step?: number; onCommit: (v: number) => void }) {
  const id = useId()
  const [text, setText] = useState<string | null>(null) // null = not editing
  const invalid = text !== null && !(text !== '' && Number(text) >= min && Number(text) <= max)
  return (
    <div className="grid gap-1 text-sm font-semibold text-ink-strong">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={text ?? String(value)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-err` : undefined}
        onFocus={() => setText(String(value))}
        onChange={(e) => {
          setText(e.target.value)
          const v = Number(e.target.value)
          if (e.target.value !== '' && v >= min && v <= max) onCommit(v)
        }}
        onBlur={() => setText(null)}
        className={`${inputClass} tnum w-28 font-normal aria-invalid:border-danger`}
      />
      {invalid ? <span id={`${id}-err`} className="text-xs font-normal text-danger">Between {min} and {max}</span> : null}
    </div>
  )
}
