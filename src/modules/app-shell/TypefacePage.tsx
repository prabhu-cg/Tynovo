import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { analyzeTypeface, describeCoverage } from '@/modules/font-validation/coverage'
import { Banner, Button, ButtonLink, inputClass } from '@/modules/shared-ui'
import { CoverageTab } from './typeface/CoverageTab'
import { CreateTypeface } from './typeface/CreateTypeface'
import { DnaPanel } from './typeface/DnaPanel'
import { GlyphsTab } from './typeface/GlyphsTab'
import { GlyphWorkspace } from './typeface/GlyphWorkspace'
import { InfoTab } from './typeface/InfoTab'
import { PreviewTab } from './typeface/PreviewTab'
import { QualityTab } from './typeface/QualityTab'
import { useTypeface } from './typeface/useTypeface'
import { VariantsTab } from './typeface/VariantsTab'
import { EditGroup } from './EditGroup'
import { GlyphViewer } from './typeface/GlyphViewer'
import { useProject } from './project'
import type { CustomTypeface } from '@/modules/brand-projects/schema'
import { rolesUsingCustom } from '@/modules/brand-system/fonts'
import { removeCustomTypeface } from '@/modules/brand-system/ops'
import { Link } from 'react-router'

const VIEWS = [
  { id: 'preview', label: 'Preview' },
  { id: 'glyphs', label: 'Glyphs' },
  { id: 'variants', label: 'Variants' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'quality', label: 'Quality' },
  { id: 'info', label: 'Font info' },
] as const
type ViewId = (typeof VIEWS)[number]['id']

export function TypefacePage() {
  const { draft } = useProject()
  if (!draft.customTypeface) return <CreateTypeface />
  return <Creator face={draft.customTypeface} />
}

function Creator({ face }: { face: CustomTypeface }) {
  const handle = useTypeface(face)
  const { draft, editor, readOnly } = useProject()
  const usedBy = rolesUsingCustom(draft)
  const [params, setParams] = useSearchParams()
  const [paramsOpen, setParamsOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const view = (VIEWS.find((v) => v.id === params.get('view'))?.id ?? 'preview') as ViewId
  const glyphParam = params.get('glyph')
  const glyph = view === 'glyphs' && glyphParam && [...glyphParam].length === 1 ? glyphParam : null
  const goTo = (fix: { view: 'glyphs' | 'info' | 'preview'; glyph?: string }) =>
    setParams((p) => { const n = new URLSearchParams(p); n.set('view', fix.view); if (fix.view === 'glyphs' && fix.glyph) n.set('glyph', fix.glyph); else n.delete('glyph'); return n })
  const openGlyph = (char: string | null, replace = false) =>
    setParams((p) => { const n = new URLSearchParams(p); n.set('view', 'glyphs'); if (char) n.set('glyph', char); else n.delete('glyph'); return n }, { replace })
  const analysis = analyzeTypeface(face)
  const errors = [...analysis.reports.values()].filter((r) => r.status === 'invalid').length

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid min-w-56 flex-1 gap-1">
          <label htmlFor="family-name" className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Typeface name</label>
          <input id="family-name" value={face.familyName} maxLength={100} readOnly={readOnly} onChange={(e) => handle.update((f) => ({ ...f, familyName: e.target.value || f.familyName }))} className={`${inputClass} max-w-md text-lg font-bold text-ink-strong`} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className="tnum text-sm text-ink-soft">{analysis.supportedCount} of {analysis.total} characters supported</p>
          <ButtonLink to="../export" variant="primary">Export…</ButtonLink>
        </div>
      </div>
      <p data-testid="typeface-usage" className="text-sm text-ink-soft">
        {usedBy.length > 0 ? <>Used in {usedBy.map((r) => r.name).join(', ')}. Changes you apply here show in the brand previews and exports. </> : <>Not used by any role yet. </>}
        <Link to="../typography#previews" className="font-semibold text-accent-strong underline underline-offset-4">{usedBy.length > 0 ? 'See it in the brand previews' : 'Choose it in a role'}</Link>
      </p>
      {errors > 0 ? <Banner tone="error">{errors} glyph{errors > 1 ? 's have' : ' has'} errors and will be left out of exported fonts, and export is blocked until they are fixed. See the Quality view.</Banner> : null}

      {glyph && readOnly ? (
        <GlyphViewer handle={handle} char={glyph} onBack={() => openGlyph(null)} />
      ) : glyph ? (
        <GlyphWorkspace handle={handle} char={glyph} onNavigate={(c) => openGlyph(c, c !== null)} />
      ) : (
      <div className="grid min-w-0 gap-6 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:pr-1">
          <Button className="lg:hidden" aria-expanded={paramsOpen} aria-controls="dna-panel" onClick={() => setParamsOpen((o) => !o)}>{paramsOpen ? 'Hide design parameters' : 'Design parameters'}</Button>
          <div id="dna-panel" className={paramsOpen ? 'block' : 'hidden lg:block'}><EditGroup><DnaPanel handle={handle} /></EditGroup></div>
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
            {view === 'glyphs' ? <GlyphsTab handle={handle} onOpen={(c) => openGlyph(c)} /> : null}
            {view === 'variants' ? <VariantsTab handle={handle} /> : null}
            {view === 'coverage' ? <CoverageTab face={face} /> : null}
            {view === 'quality' ? <QualityTab handle={handle} onGo={goTo} /> : null}
            {view === 'info' ? <EditGroup><InfoTab handle={handle} /></EditGroup> : null}
          </div>
          <p className="mt-8 text-xs text-ink-soft">{describeCoverage(analysis)}</p>
        </div>
      </div>
      )}
      <div className={glyph ? 'hidden' : 'mt-2 border-t border-line pt-4'}>
        {confirmRemove ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirm removing the typeface">
            <span className="text-sm font-semibold text-danger">Remove “{face.familyName}” with its {face.variants.length} saved variants, {Object.keys(face.overrides).length} glyph overrides and restore points?{usedBy.length > 0 ? ` ${usedBy.map((r) => r.name).join(', ')} will have no font assigned.` : ''}</span>
            <Button variant="danger" onClick={() => editor.patch(removeCustomTypeface)}>Remove typeface</Button>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)}>Keep it</Button>
          </div>
        ) : (
          <Button variant="ghost" disabled={readOnly} onClick={() => setConfirmRemove(true)}>Remove typeface from project…</Button>
        )}
      </div>
    </div>
  )
}
