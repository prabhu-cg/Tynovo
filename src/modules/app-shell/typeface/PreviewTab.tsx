import { useDeferredValue, useId, useState } from 'react'
import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { SpecimenSvg } from '@/modules/glyph-editor/SpecimenSvg'
import type { CustomTypeface } from '@/modules/brand-projects/schema'
import { inputClass } from '@/modules/shared-ui'

const SAMPLES = ['Hamburgefonstiv', 'THE QUICK BROWN FOX', 'jumps over the lazy dog', '0123456789 !?&']

export function PreviewTab({ face }: { face: CustomTypeface }) {
  const [text, setText] = useState(SAMPLES[0]!)
  const [guides, setGuides] = useState(true)
  const id = useId()
  const live = useDeferredValue(face)
  const analysis = analyzeTypeface(live)
  const absent = [...new Set([...text])].filter((c) => analysis.reports.get(c)?.status !== 'supported')
  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid min-w-56 flex-1 gap-1">
          <label htmlFor={id} className="text-sm font-semibold text-ink-strong">Preview text</label>
          <input id={id} value={text} onChange={(e) => setText(e.target.value)} maxLength={60} className={inputClass} />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-strong md:min-h-9"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} className="size-4 accent-accent" />Metric guides</label>
      </div>
      <div className="min-w-0 rounded-md border border-line bg-paper p-4 md:p-6">
        <SpecimenSvg face={live} text={text || ' '} guides={guides} label={`Specimen: ${text}`} />
      </div>
      {absent.length > 0 ? (
        <p role="status" className="text-sm text-ink-soft">Not in this typeface, so left out of the preview: <span className="font-semibold text-ink-strong">{absent.map((c) => (c === ' ' ? 'space' : c)).join(' ')}</span></p>
      ) : null}
      <ul className="grid gap-px overflow-hidden rounded-md border border-line bg-line">
        {SAMPLES.map((s) => (
          <li key={s} className="min-w-0 bg-paper px-4 py-3"><button type="button" onClick={() => setText(s)} className="block w-full min-w-0 cursor-pointer text-left" aria-label={`Use sample: ${s}`}><SpecimenSvg face={live} text={s} guides={false} label={`Sample: ${s}`} /></button></li>
        ))}
      </ul>
    </div>
  )
}
