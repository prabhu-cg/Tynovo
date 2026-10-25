import { useId, useMemo, useState } from 'react'
import { SpecimenSvg } from '@/modules/glyph-editor/SpecimenSvg'
import { defaultDna, FAMILY_LABELS, type Family } from '@/modules/typeface-engine/dna'
import { createTypeface } from '@/modules/typeface-engine/typeface'
import { RangeField, Segmented } from '@/modules/shared-ui'

const FAMILIES: Family[] = ['geometric', 'rounded', 'modular']

/** The real generator, running live. Not a mock-up: the outlines below are the glyphs the exporter would write. */
export function InteractiveSpecimen() {
  const [family, setFamily] = useState<Family>('geometric')
  const [stroke, setStroke] = useState(defaultDna('geometric').strokeThickness)
  const [width, setWidth] = useState(1)
  const [text, setText] = useState('Hamburg')
  const id = useId()
  const face = useMemo(() => {
    const t = createTypeface('marketing', family)
    return { ...t, dna: { ...t.dna, strokeThickness: stroke, widthScale: width } }
  }, [family, stroke, width])
  return (
    <div className="rounded-md border border-line bg-paper p-4 shadow-(--shadow-lift) md:p-5">
      <SpecimenSvg face={face} text={text || ' '} label={`${FAMILY_LABELS[family].name} specimen reading ${text || 'nothing'}, drawn from live glyph outlines`} />
      <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
        <Segmented
          label="Family"
          value={family}
          options={FAMILIES.map((f) => ({ value: f, label: FAMILY_LABELS[f].name.replace(' geometric', '') }))}
          onChange={(f) => {
            setFamily(f)
            setStroke(defaultDna(f).strokeThickness)
          }}
        />
        <div className="grid gap-1 text-sm font-semibold text-ink-strong">
          <label htmlFor={id}>Text</label>
          <input id={id} value={text} maxLength={12} onChange={(e) => setText(e.target.value)} aria-describedby={`${id}-hint`} className="min-h-11 rounded-md border border-line-strong px-3 font-normal text-ink focus:border-accent md:min-h-9" />
        </div>
        <RangeField label="Stroke thickness" value={stroke} min={40} max={160} step={4} onChange={setStroke} />
        <RangeField label="Width" value={width} min={0.7} max={1.4} step={0.02} format={(v) => v.toFixed(2)} onChange={setWidth} />
      </div>
      <p id={`${id}-hint`} className="mt-3 text-xs text-ink-soft">Early engine: letters, digits and most punctuation work, a few symbols do not yet, and characters without a glyph are skipped.</p>
    </div>
  )
}
