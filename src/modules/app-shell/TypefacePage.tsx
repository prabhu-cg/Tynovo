import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { analyzeTypeface, describeCoverage } from '@/modules/font-validation/coverage'
import { Banner, Button, ButtonLink, inputClass } from '@/modules/shared-ui'
import { CoverageTab } from './typeface/CoverageTab'
import { CreateTypeface } from './typeface/CreateTypeface'
import { DnaPanel } from './typeface/DnaPanel'
import { GlyphsTab } from './typeface/GlyphsTab'
import { PreviewTab } from './typeface/PreviewTab'
import { useTypeface } from './typeface/useTypeface'
import { VariantsTab } from './typeface/VariantsTab'
import { useProject } from './project'
import type { CustomTypeface } from '@/modules/brand-projects/schema'

const VIEWS = [
  { id: 'preview', label: 'Preview' },
  { id: 'glyphs', label: 'Glyphs' },
  { id: 'variants', label: 'Variants' },
  { id: 'coverage', label: 'Coverage' },
] as const
type ViewId = (typeof VIEWS)[number]['id']

export function TypefacePage() {
  const { draft } = useProject()
  if (!draft.customTypeface) return <CreateTypeface />
  return <Creator face={draft.customTypeface} />
}

function Creator({ face }: { face: CustomTypeface }) {
  const handle = useTypeface(face)
  const { editor } = useProject()
  const [params, setParams] = useSearchParams()
  const [paramsOpen, setParamsOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const view = (VIEWS.find((v) => v.id === params.get('view'))?.id ?? 'preview') as ViewId
  const analysis = analyzeTypeface(face)
  const errors = [...analysis.reports.values()].filter((r) => r.status === 'invalid').length

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid min-w-56 flex-1 gap-1">
          <label htmlFor="family-name" className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Typeface name</label>
          <input id="family-name" value={face.familyName} maxLength={100} onChange={(e) => handle.update((f) => ({ ...f, familyName: e.target.value || f.familyName }))} className={`${inputClass} max-w-md text-lg font-bold text-ink-strong`} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className="tnum text-sm text-ink-soft">{analysis.supportedCount} of {analysis.total} characters supported</p>
          <ButtonLink to="../export" variant="primary">Export…</ButtonLink>
        </div>
      </div>
      {errors > 0 ? <Banner tone="error">{errors} glyph{errors > 1 ? 's have' : ' has'} errors and will be left out of exported fonts. See the Coverage view.</Banner> : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:pr-1">
          <Button className="lg:hidden" aria-expanded={paramsOpen} aria-controls="dna-panel" onClick={() => setParamsOpen((o) => !o)}>{paramsOpen ? 'Hide design parameters' : 'Design parameters'}</Button>
          <div id="dna-panel" className={paramsOpen ? 'block' : 'hidden lg:block'}><DnaPanel handle={handle} /></div>
        </div>

        <div className="min-w-0">
          <nav aria-label="Typeface views" className="-mb-px flex gap-5 overflow-x-auto border-b border-line">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-current={view === v.id ? 'page' : undefined}
                onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set('view', v.id); return n }, { replace: true })}
                className={`inline-flex min-h-11 cursor-pointer items-center border-b-2 px-1 text-sm font-semibold whitespace-nowrap transition-colors md:min-h-10 ${view === v.id ? 'border-accent text-ink-strong' : 'border-transparent text-ink-soft hover:text-ink-strong'}`}
              >
                {v.label}
              </button>
            ))}
          </nav>
          <div className="mt-6 min-w-0">
            {view === 'preview' ? <PreviewTab face={face} /> : null}
            {view === 'glyphs' ? <GlyphsTab handle={handle} /> : null}
            {view === 'variants' ? <VariantsTab handle={handle} /> : null}
            {view === 'coverage' ? <CoverageTab face={face} /> : null}
          </div>
          <p className="mt-8 text-xs text-ink-soft">{describeCoverage(analysis)}</p>
        </div>
      </div>
      <div className="mt-2 border-t border-line pt-4">
        {confirmRemove ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirm removing the typeface">
            <span className="text-sm font-semibold text-danger">Remove “{face.familyName}” with its {face.variants.length} saved variants, {Object.keys(face.overrides).length} glyph overrides and restore points?</span>
            <Button variant="danger" onClick={() => editor.patch((p) => ({ ...p, customTypeface: null }))}>Remove typeface</Button>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)}>Keep it</Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmRemove(true)}>Remove typeface from project…</Button>
        )}
      </div>
    </div>
  )
}
