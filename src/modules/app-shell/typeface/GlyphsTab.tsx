import { useDeferredValue, useState } from 'react'
import { analyzeTypeface, type GlyphReport } from '@/modules/font-validation/coverage'
import { GlyphThumb } from '@/modules/glyph-editor/GlyphThumb'
import { GROUPS } from '@/modules/typeface-engine/charset'
import { deriveMetrics } from '@/modules/typeface-engine/dna'
import { Segmented } from '@/modules/shared-ui'
import type { TypefaceHandle } from './useTypeface'

type Filter = 'all' | 'upper' | 'lower' | 'digits' | 'punctuation'

const STATUS_TEXT = { supported: 'supported', invalid: 'error', missing: 'missing' } as const

export function GlyphsTab({ handle, onOpen }: { handle: TypefaceHandle; onOpen: (char: string) => void }) {
  const live = useDeferredValue(handle.face)
  const analysis = analyzeTypeface(live)
  const metrics = deriveMetrics(live.dna)
  const [filter, setFilter] = useState<Filter>('all')
  const chars = GROUPS.filter((g) => g.id !== 'space' && (filter === 'all' || g.id === filter)).flatMap((g) => [...g.chars])
  const overridden = (c: string) => c in live.overrides

  return (
    <div className="grid min-w-0 gap-4">
      <Segmented
        label="Show"
        value={filter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'upper', label: 'A–Z' },
          { value: 'lower', label: 'a–z' },
          { value: 'digits', label: '0–9' },
          { value: 'punctuation', label: '!?&' },
        ]}
        onChange={setFilter}
      />
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-2" aria-label="Glyphs">
        {chars.map((c) => {
          const r = analysis.reports.get(c) as GlyphReport
          return (
            <li key={c}>
              <button
                type="button"
                aria-label={`${c}, ${STATUS_TEXT[r.status]}${overridden(c) ? ', has overrides' : ''}`}
                onClick={() => onOpen(c)}
                className={`relative grid aspect-[3/4] w-full cursor-pointer place-items-center rounded-md border p-1 transition-colors ${r.status === 'supported' ? 'border-line bg-paper hover:border-ink' : r.status === 'invalid' ? 'border-danger bg-[#fdeceb]' : 'border-dashed border-line-strong bg-sheet text-ink-soft hover:border-ink'}`}
              >
                {r.glyph ? <GlyphThumb glyph={r.glyph} metrics={metrics} tone={r.status === 'invalid' ? 'danger' : 'ink'} /> : <span aria-hidden="true" className="text-xl font-bold">{c}</span>}
                <span aria-hidden="true" className="absolute bottom-0.5 left-1 text-[0.65rem] font-semibold text-ink-soft">{c}</span>
                {overridden(c) ? <span aria-hidden="true" title="Has overrides" className="absolute top-1 right-1 size-2 rounded-full bg-accent" /> : null}
                {r.status !== 'supported' ? <span className={`absolute right-1 bottom-0.5 text-[0.6rem] font-bold uppercase ${r.status === 'invalid' ? 'text-danger' : 'text-ink-soft'}`}>{STATUS_TEXT[r.status]}</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-ink-soft"><span aria-hidden="true" className="mr-1 inline-block size-2 rounded-full bg-accent align-middle" />marks a glyph with overrides. Choose a glyph to edit its outline, shape and spacing. A glyph with errors is left out of exported fonts.</p>
    </div>
  )
}
