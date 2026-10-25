import { useDeferredValue, useMemo, useState } from 'react'
import { FORMATS, FORMAT_IDS, type FontFormatId } from '@/modules/font-export/formats'
import { useFileChecks } from '@/modules/font-export/useFileChecks'
import { CATEGORY_LABEL, runQualityChecks, type QualityFinding, type QualityFix, type QualitySeverity } from '@/modules/font-validation/quality'
import { AlertIcon, Banner, Button, CheckIcon, InfoIcon, Segmented } from '@/modules/shared-ui'
import type { TypefaceHandle } from './useTypeface'

type Filter = 'all' | QualitySeverity

const SEVERITY: Record<QualitySeverity, { label: string; text: string; icon: 'alert' | 'info' }> = {
  blocking: { label: 'Blocks export', text: 'text-danger', icon: 'alert' },
  warning: { label: 'Warning', text: 'text-warn', icon: 'alert' },
  recommendation: { label: 'Recommendation', text: 'text-ink-soft', icon: 'info' },
}

const show = (c: string) => (c === ' ' ? 'space' : c)

export function QualityTab({ handle, onGo }: { handle: TypefaceHandle; onGo: (fix: Extract<QualityFix, { kind: 'go' }>) => void }) {
  const live = useDeferredValue(handle.face)
  const [format, setFormat] = useState<FontFormatId>('ttf')
  const [filter, setFilter] = useState<Filter>('all')
  const [applied, setApplied] = useState('')
  const file = useFileChecks(live, format)
  const report = useMemo(
    () => runQualityChecks(live, file.status === 'done' ? { issues: file.issues, format: FORMATS[format].label } : undefined),
    [live, file, format],
  )
  const findings = report.findings.filter((f) => filter === 'all' || f.severity === filter)

  const runFix = (f: QualityFix) => {
    if (f.kind === 'go') return onGo(f)
    handle.update(f.apply)
    setApplied(`Applied: ${f.label}.`)
  }

  return (
    <div className="grid min-w-0 gap-8">
      <section aria-labelledby="q-h" className="grid gap-3">
        <div>
          <h2 id="q-h" className="text-lg font-bold">Quality checks</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">Measured facts about this typeface, each with the numbers behind it. There is no overall score: a single number would suggest an objective measure of quality, and these checks only measure geometry and metadata.</p>
        </div>
        <ul className="tnum flex flex-wrap gap-x-6 gap-y-1 text-sm" aria-label="Summary">
          <li><strong className={report.counts.blocking ? 'text-danger' : 'text-ink-strong'}>{report.counts.blocking}</strong> blocking</li>
          <li><strong className="text-ink-strong">{report.counts.warning}</strong> warning{report.counts.warning === 1 ? '' : 's'}</li>
          <li><strong className="text-ink-strong">{report.counts.recommendation}</strong> recommendation{report.counts.recommendation === 1 ? '' : 's'}</li>
        </ul>
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Segmented label="Show" value={filter} options={[{ value: 'all', label: 'All' }, { value: 'blocking', label: 'Blocking' }, { value: 'warning', label: 'Warnings' }, { value: 'recommendation', label: 'Tips' }]} onChange={setFilter} />
          <Segmented label="Exported file checked as" value={format} options={FORMAT_IDS.map((f) => ({ value: f, label: FORMATS[f].extension }))} onChange={setFormat} />
        </div>
        <p role="status" aria-live="polite" className="min-h-5 text-sm text-ok">{applied}</p>
      </section>

      <section aria-labelledby="qf-h" className="grid max-w-3xl gap-3">
        <h2 id="qf-h" className="text-lg font-bold">Exported file</h2>
        {file.status === 'checking' ? <p role="status" className="text-sm text-ink-soft">Building the {FORMATS[format].extension} file and reading it back…</p> : null}
        {file.status === 'failed' ? <Banner tone="error">The {FORMATS[format].extension} file could not be built: {file.message}. Your project is unchanged.</Banner> : null}
        {file.status === 'done' ? (
          <>
            <p className="text-sm text-ink-soft">A {file.bytes.toLocaleString()}-byte {FORMATS[format].label} file was built in memory and opened again. Nothing was downloaded.</p>
            {file.issues.some((i) => i.severity === 'error') ? null : (
              <ul className="grid gap-1.5 text-sm" aria-label="What held">
                {file.passed.map((p) => <li key={p} className="flex items-start gap-2"><span className="mt-0.5 shrink-0 text-ok"><CheckIcon /></span>{p}</li>)}
              </ul>
            )}
          </>
        ) : null}
      </section>

      <section aria-labelledby="qlist-h" className="grid max-w-3xl gap-3">
        <h2 id="qlist-h" className="text-lg font-bold">Findings</h2>
        {findings.length === 0 ? (
          <p className="flex items-start gap-2 text-sm"><span className="mt-0.5 text-ok"><CheckIcon /></span>{filter === 'all' ? 'The checks found nothing to report.' : 'Nothing in this category.'}</p>
        ) : (
          <ol className="grid gap-3" aria-label="Quality findings">
            {findings.map((f) => <Finding key={f.id} f={f} onFix={runFix} onGlyph={(c) => onGo({ kind: 'go', label: '', view: 'glyphs', glyph: c })} />)}
          </ol>
        )}
      </section>

      <section aria-labelledby="qhow-h" className="max-w-3xl">
        <details className="rounded-md border border-line bg-paper px-4 py-3">
          <summary id="qhow-h" className="min-h-8 cursor-pointer text-sm font-bold text-ink-strong">What these checks measure, and what they cannot tell you</summary>
          <dl className="mt-3 grid gap-4 text-sm">
            {report.checks.map((c) => (
              <div key={c.id}>
                <dt className="font-semibold text-ink-strong">{c.name} <span className="font-normal text-ink-soft">({CATEGORY_LABEL[c.category]})</span></dt>
                <dd className="mt-1 text-ink">{c.measures}</dd>
                <dd className="mt-1 text-ink-soft">Limits: {c.limits}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>
    </div>
  )
}

function Finding({ f, onFix, onGlyph }: { f: QualityFinding; onFix: (fix: QualityFix) => void; onGlyph: (c: string) => void }) {
  const s = SEVERITY[f.severity]
  // The glyph chips already open the editor; do not repeat them as buttons.
  const shownFixes = f.fixes.filter((x) => !(x.kind === 'go' && x.view === 'glyphs' && x.glyph && f.glyphs.includes(x.glyph)))
  return (
    <li className="rounded-md border border-line bg-paper p-4">
      <article aria-label={f.title} className="grid gap-2">
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase ${s.text}`}>{s.icon === 'alert' ? <AlertIcon /> : <InfoIcon />}{s.label}</span>
          <h3 className="text-base font-bold text-ink-strong">{f.title}</h3>
          <span className="text-xs text-ink-soft">{CATEGORY_LABEL[f.category]}</span>
        </header>
        <p className="text-sm">{f.detail}</p>
        {f.evidence.length > 0 ? (
          <details className="text-sm">
            <summary className="min-h-8 cursor-pointer font-semibold text-accent-strong">Measurements ({f.evidence.length})</summary>
            <ul className="tnum mt-1 grid gap-0.5 text-ink-soft">{f.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </details>
        ) : null}
        <p className="text-sm text-ink-soft"><strong className="font-semibold text-ink">Why it matters. </strong>{f.why}</p>
        {f.glyphs.length > 0 ? (
          <p className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-ink-soft">Open in the editor:</span>
            {f.glyphs.slice(0, 24).map((c) => (
              <button key={c} type="button" onClick={() => onGlyph(c)} aria-label={`Open ${show(c)} in the editor`} className="min-h-8 min-w-8 cursor-pointer rounded-md border border-line-strong bg-paper px-1.5 text-sm font-bold text-ink-strong hover:border-ink">{show(c)}</button>
            ))}
            {f.glyphs.length > 24 ? <span className="text-xs text-ink-soft">and {f.glyphs.length - 24} more</span> : null}
          </p>
        ) : null}
        {shownFixes.length > 0 ? <div className="flex flex-wrap gap-2 pt-1">{shownFixes.map((x) => <Button key={x.label} onClick={() => onFix(x)}>{x.label}</Button>)}</div> : null}
      </article>
    </li>
  )
}
