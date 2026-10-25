import { useMemo, useState } from 'react'
import { AppSeo } from '@/modules/marketing/Seo'
import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { SpecimenSvg } from '@/modules/glyph-editor/SpecimenSvg'
import { Banner, Button, RangeField, Segmented } from '@/modules/shared-ui'
import { defaultDna, FAMILY_LABELS, type Family } from '@/modules/typeface-engine/dna'
import { createTypeface } from '@/modules/typeface-engine/typeface'
import { downloadBytes } from './download'
import { useBuiltFont } from './useBuiltFont'
import { useGeneratedFontFace } from './useGeneratedFontFace'

const FAMILY = 'Lab Typeface'
const FAMILIES: Family[] = ['geometric', 'rounded', 'modular']

/** Feasibility page: design in, real TTF out, then read back and inspected, and rendered by the browser from that file. */
export function FontLabPage() {
  const [family, setFamily] = useState<Family>('geometric')
  const [stroke, setStroke] = useState(defaultDna('geometric').strokeThickness)
  const [roundness, setRoundness] = useState(defaultDna('geometric').roundness)
  const [width, setWidth] = useState(1)
  const [sample, setSample] = useState('Hamburgefonstiv 0123')

  const typeface = useMemo(() => {
    const t = createTypeface('lab', family, FAMILY)
    return { ...t, dna: { ...t.dna, strokeThickness: stroke, roundness, widthScale: width } }
  }, [family, stroke, roundness, width])
  const { built, error } = useBuiltFont(typeface)
  const fontState = useGeneratedFontFace(typeface, FAMILY)
  const analysis = analyzeTypeface(typeface)

  const errors = built ? built.model.errorCount + built.binary.errorCount : 0
  const warnings = built ? built.model.warningCount + built.binary.warningCount : 0

  return (
    <div className="mx-auto max-w-5xl">
      <AppSeo title="Font lab" />
      <h1 className="text-3xl font-extrabold">Font lab</h1>
      <p className="mt-1 max-w-2xl text-ink-soft">Feasibility check. A design drives the generator, the app builds a genuine TrueType file, reads it back, and the browser renders the text below from that file.</p>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <form className="grid content-start gap-4" onSubmit={(e) => e.preventDefault()} aria-label="Lab typeface design">
          <Segmented
            label="Family"
            value={family}
            options={FAMILIES.map((f) => ({ value: f, label: FAMILY_LABELS[f].name.replace(' geometric', '') }))}
            onChange={(f) => {
              setFamily(f)
              setStroke(defaultDna(f).strokeThickness)
              setRoundness(defaultDna(f).roundness)
            }}
          />
          <RangeField label="Stroke thickness" value={stroke} min={30} max={200} step={2} onChange={setStroke} />
          <RangeField label="Roundness" value={roundness} min={0} max={1} step={0.05} format={(v) => v.toFixed(2)} onChange={setRoundness} />
          <RangeField label="Width" value={width} min={0.6} max={1.6} step={0.02} format={(v) => v.toFixed(2)} onChange={setWidth} />
          <Button variant="primary" disabled={!built || errors > 0} onClick={() => built && downloadBytes(built.build.bytes, built.build.filename, built.build.mimeType)}>
            {built ? `Download ${built.build.filename}` : 'Building…'}
          </Button>
        </form>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
          {error ? <Banner tone="error">Could not build the font: {error}</Banner> : null}
          <div className="rounded-md border border-line bg-paper p-4">
            <p className="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">Outline specimen (SVG from the glyph model)</p>
            <SpecimenSvg face={typeface} text="Hamburg" label="Outline specimen Hamburg" />
          </div>

          <div className="rounded-md border border-line bg-paper p-4">
            <label className="grid gap-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">
              Rendered by the browser from the exported TTF
              <input value={sample} onChange={(e) => setSample(e.target.value)} maxLength={40} className="rounded-md border border-line-strong px-3 py-1 text-base font-normal tracking-normal text-ink normal-case focus:border-accent" />
            </label>
            <p data-testid="font-sample" data-font-state={fontState} className="mt-3 text-5xl leading-tight break-words text-ink-strong" style={{ fontFamily: `'${FAMILY}', monospace` }}>{sample || ' '}</p>
            <p className="mt-1 text-xs text-ink-soft">Characters the engine cannot build yet fall back to monospace, so you can tell what is the generated font.</p>
          </div>

          <dl className="tnum grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 rounded-md border border-line bg-paper p-4 text-sm" aria-label="Exported file facts">
            <dt className="text-ink-soft">Format</dt><dd>{built ? `${built.readBack.format} (sfnt), ${built.build.bytes.byteLength} bytes` : '…'}</dd>
            <dt className="text-ink-soft">Family (read back)</dt><dd>{built?.readBack.family ?? '…'}</dd>
            <dt className="text-ink-soft">Glyphs in file (incl. .notdef)</dt><dd>{built?.readBack.glyphs ?? '…'} of {analysis.total} target characters supported</dd>
            <dt className="text-ink-soft">Tables</dt><dd>{built?.readBack.tables.join(', ') ?? '…'}</dd>
            <dt className="text-ink-soft">SHA-256</dt><dd className="break-all">{built?.sha256 ?? '…'}</dd>
            <dt className="text-ink-soft">Validation</dt><dd>{built ? `${errors} errors, ${warnings} warnings (model + binary)` : '…'}</dd>
            <dt className="text-ink-soft">Browser load</dt><dd>{fontState}</dd>
          </dl>
        </div>
      </div>
    </div>
  )
}
