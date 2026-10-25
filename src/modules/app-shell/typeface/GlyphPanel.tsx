import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { GlyphThumb } from '@/modules/glyph-editor/GlyphThumb'
import { deriveMetrics } from '@/modules/typeface-engine/dna'
import { freezeGlyph, resetGlyph, setGlyphParams, setGlyphSpacing, unfreezeGlyph } from '@/modules/typeface-engine/edit'
import type { GlyphParams } from '@/modules/brand-projects/schema'
import { Banner, Button, Drawer, NumberField, RangeField } from '@/modules/shared-ui'
import type { TypefaceHandle } from './useTypeface'

const PARAMS: Array<{ key: keyof GlyphParams; label: string; min: number; max: number; step: number }> = [
  { key: 'widthScale', label: 'Width', min: 0.4, max: 2.2, step: 0.02 },
  { key: 'strokeThickness', label: 'Stroke thickness', min: 20, max: 240, step: 2 },
  { key: 'contrast', label: 'Contrast', min: 0.4, max: 1.5, step: 0.02 },
  { key: 'roundness', label: 'Roundness', min: 0, max: 1, step: 0.05 },
  { key: 'cornerRadius', label: 'Corner size', min: 0, max: 200, step: 2 },
]

/** Side panel for one glyph: what it is, whether it is valid, and its explicit overrides. */
export function GlyphPanel({ handle, char, onClose }: { handle: TypefaceHandle; char: string | null; onClose: () => void }) {
  const { face, update } = handle
  const open = char !== null
  const report = char ? analyzeTypeface(face).reports.get(char) : undefined
  const metrics = deriveMetrics(face.dna)
  const o = char ? face.overrides[char] : undefined
  const frozen = !!o?.contours
  const title = char ? `Glyph ${char === ' ' ? 'space' : char}` : 'Glyph'

  let lsb = 0
  let rsb = 0
  if (report?.glyph && report.glyph.contours.length > 0) {
    const xs = report.glyph.contours.flat().map((p) => p.x)
    lsb = Math.min(...xs)
    rsb = report.glyph.advanceWidth - Math.max(...xs)
  }

  return (
    <Drawer open={open} title={title} onClose={onClose}>
      {char && report ? (
        <div className="grid gap-5">
          <div className="grid h-56 place-items-center rounded-md border border-line bg-sheet p-2">
            {report.glyph ? <GlyphThumb glyph={report.glyph} metrics={metrics} tone={report.status === 'invalid' ? 'danger' : 'ink'} /> : <p className="text-sm text-ink-soft">No outline</p>}
          </div>

          {report.status === 'missing' ? (
            <Banner tone="info">{report.reason === 'no-recipe' ? 'This character has no design yet, so it is not in the font.' : report.message}</Banner>
          ) : null}
          {report.status === 'invalid' ? (
            <Banner tone="error">
              <strong>Not exported.</strong> This glyph fails validation:
              <ul className="mt-1 list-disc pl-5">{report.issues.filter((i) => i.severity === 'error').map((i) => <li key={i.code}>{i.message}</li>)}</ul>
            </Banner>
          ) : null}
          {report.status === 'supported' && report.issues.length > 0 ? <Banner tone="warn">{report.issues.map((i) => i.message).join(' ')}</Banner> : null}

          {report.glyph ? (
            <>
              <section aria-label="Shape overrides" className="grid gap-4">
                <h3 className="text-sm font-bold text-ink-strong">Shape for this glyph only</h3>
                {frozen ? <p className="text-sm text-ink-soft">The outline is frozen, so these shape settings do not apply until you unfreeze it.</p> : null}
                {PARAMS.map((p) => {
                  const own = o?.params?.[p.key]
                  const value = own ?? face.dna[p.key]
                  return (
                    <div key={p.key} className="grid gap-1">
                      <RangeField label={p.label} value={value} min={p.min} max={p.max} step={p.step} format={(v) => (p.step < 1 ? v.toFixed(2) : String(v))} defaultValue={face.dna[p.key]} onChange={(v) => update((f) => setGlyphParams(f, char, { [p.key]: v }))} />
                      {own !== undefined ? (
                        <button type="button" onClick={() => update((f) => setGlyphParams(f, char, { [p.key]: undefined }))} className="min-h-8 justify-self-start text-xs font-semibold text-accent-strong underline underline-offset-4">Follow the global value ({face.dna[p.key]})</button>
                      ) : <p className="text-xs text-ink-soft">Following the global value.</p>}
                    </div>
                  )
                })}
              </section>

              <section aria-label="Spacing overrides" className="grid gap-3">
                <h3 className="text-sm font-bold text-ink-strong">Spacing</h3>
                <div className="flex flex-wrap gap-4">
                  <NumberField label="Left bearing" value={o?.leftBearing ?? lsb} min={-300} max={600} onCommit={(v) => update((f) => setGlyphSpacing(f, char, { leftBearing: v }))} />
                  <NumberField label="Right bearing" value={o?.rightBearing ?? rsb} min={-300} max={600} onCommit={(v) => update((f) => setGlyphSpacing(f, char, { rightBearing: v }))} />
                  <NumberField label="Advance width" value={report.glyph.advanceWidth} min={0} max={4000} onCommit={(v) => update((f) => setGlyphSpacing(f, char, { advanceWidth: v }))} />
                </div>
                {o && (o.leftBearing !== undefined || o.rightBearing !== undefined || o.advanceWidth !== undefined) ? (
                  <button type="button" onClick={() => update((f) => setGlyphSpacing(f, char, { leftBearing: undefined, rightBearing: undefined, advanceWidth: undefined }))} className="min-h-8 justify-self-start text-xs font-semibold text-accent-strong underline underline-offset-4">Follow automatic spacing</button>
                ) : null}
              </section>

              <section aria-label="Outline" className="grid gap-2">
                <h3 className="text-sm font-bold text-ink-strong">Outline</h3>
                <p className="text-sm text-ink-soft">Freezing keeps this exact outline: later changes to the global shape will not reach this glyph.</p>
                <div>{frozen ? <Button onClick={() => update((f) => unfreezeGlyph(f, char))}>Unfreeze outline</Button> : <Button onClick={() => update((f) => freezeGlyph(f, char))}>Freeze outline</Button>}</div>
              </section>
            </>
          ) : null}

          <div className="border-t border-line pt-4">
            <Button variant="danger" disabled={!o} onClick={() => update((f) => resetGlyph(f, char))}>Reset all overrides on this glyph</Button>
            <p className="mt-2 text-xs text-ink-soft">{o ? 'Global edits never remove overrides. Only this button does.' : 'This glyph has no overrides.'}</p>
          </div>
        </div>
      ) : null}
    </Drawer>
  )
}
