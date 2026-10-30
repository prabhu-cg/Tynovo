import type { ReactNode } from 'react'
import type { Contour, CustomTypeface, GlyphParams } from '@/modules/brand-projects/schema'
import type { GlyphIssue } from '@/modules/font-validation/glyphs'
import type { DraftFix } from '@/modules/glyph-editor/draft'
import { parseKey, type Selection } from '@/modules/glyph-editor/outline'
import { AlertIcon, Button, CheckIcon, InfoIcon, NumberField, RangeField } from '@/modules/shared-ui'

const PARAMS: Array<{ key: keyof GlyphParams; label: string; min: number; max: number; step: number }> = [
  { key: 'widthScale', label: 'Width', min: 0.4, max: 2.2, step: 0.02 },
  { key: 'strokeThickness', label: 'Stroke thickness', min: 20, max: 240, step: 2 },
  { key: 'contrast', label: 'Contrast', min: 0.4, max: 1.5, step: 0.02 },
  { key: 'roundness', label: 'Roundness', min: 0, max: 1, step: 0.05 },
  { key: 'cornerRadius', label: 'Corner size', min: 0, max: 200, step: 2 },
]

const link = 'min-h-8 justify-self-start text-xs font-semibold text-accent-strong underline underline-offset-4'

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="grid gap-3 border-t border-line py-4 first:border-t-0 first:pt-0">
      <h3 id={id} className="text-sm font-bold text-ink-strong">{title}</h3>
      {children}
    </section>
  )
}

export interface InspectorProps {
  face: CustomTypeface
  char: string
  contours: Contour[]
  selection: Selection
  issues: GlyphIssue[]
  fixes: DraftFix[]
  onFix: (fix: DraftFix) => void
  onSetPoint: (c: number, p: number, x: number, y: number) => void
  onStepPoint: (dir: 1 | -1) => void
  onInsert: () => void
  onDelete: () => void
  canCurve: boolean
  canStraighten: boolean
  canSmooth: boolean
  canFitCurves: boolean
  onFitCurves: () => void
  onCurve: () => void
  onStraighten: () => void
  onSmooth: () => void
  /** Set when the plan leaves out curve editing. */
  curvesNote?: string | undefined
  curvesHidden?: boolean
  /** 'parametric': the glyph still follows the design, so spacing is stored as overrides. 'outline': it is hand-edited. */
  mode: 'parametric' | 'outline'
  advance: number
  left: number
  right: number
  onAdvance: (v: number) => void
  onLeft: (v: number) => void
  onRight: (v: number) => void
  hasSpacingOverride: boolean
  onFollowSpacing: () => void
  frozen: boolean
  dirty: boolean
  canReset: boolean
  onReset: () => void
  onLock: () => void
  hasOverrides: boolean
  onResetAll: () => void
  onParam: (key: keyof GlyphParams, value: number | undefined) => void
  /** Set when the plan leaves out adding and deleting points, or per-glyph shape settings. */
  structureNote?: string | undefined
  structureHidden?: boolean
  shapeNote?: string | undefined
  shapeHidden?: boolean
}

export function GlyphInspector(p: InspectorProps) {
  const o = p.face.overrides[p.char]
  const errors = p.issues.filter((i) => i.severity === 'error')
  const warnings = p.issues.filter((i) => i.severity !== 'error')
  const keys = [...p.selection]
  const only = keys.length === 1 ? parseKey(keys[0]!) : null
  const pt = only ? p.contours[only.c]?.[only.p] : undefined
  const shapeLocked = p.frozen || p.dirty

  return (
    <div className="grid gap-0">
      <Section id="gi-checks" title="Checks on this outline">
        {p.issues.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-ink"><span className="mt-0.5 text-ok"><CheckIcon /></span>No problems found. This glyph will be in the exported font.</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {[...errors, ...warnings].map((i) => (
              <li key={`${i.code}-${i.message}`} className="flex items-start gap-2">
                <span className={`mt-0.5 shrink-0 ${i.severity === 'error' ? 'text-danger' : 'text-warn'}`}><AlertIcon /></span>
                <span><span className={`font-bold ${i.severity === 'error' ? 'text-danger' : 'text-warn'}`}>{i.severity === 'error' ? 'Blocks export. ' : 'Warning. '}</span>{i.message}</span>
              </li>
            ))}
          </ul>
        )}
        {errors.length > 0 ? <p className="text-xs text-ink-soft">A glyph with an error is left out of exported fonts, and export is blocked until it is fixed. You can still apply it and keep working.</p> : null}
        {p.fixes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {p.fixes.map((f) => <Button key={f.label} onClick={() => p.onFix(f)}>{f.label}</Button>)}
          </div>
        ) : null}
      </Section>

      <Section id="gi-point" title="Selected point">
        {pt && only ? (
          <>
            <p className="text-xs text-ink-soft" data-testid="point-kind">{pt.onCurve ? 'On-curve point' : 'Control point: it shapes the curve but is not on it'}. Point {only.p + 1} of {p.contours[only.c]!.length} in contour {only.c + 1} of {p.contours.length}</p>
            <div className="flex flex-wrap gap-3">
              <NumberField label="X" value={pt.x} min={-1000} max={4000} onCommit={(v) => p.onSetPoint(only.c, only.p, v, pt.y)} />
              <NumberField label="Y" value={pt.y} min={-1500} max={2500} onCommit={(v) => p.onSetPoint(only.c, only.p, pt.x, v)} />
            </div>
          </>
        ) : keys.length > 1 ? (
          <p className="text-sm">{keys.length} points selected. Drag one of them, or use the arrow keys (Shift moves 10 units).</p>
        ) : (
          <p className="text-sm text-ink-soft">Nothing selected. Click a point, drag a box around several, or press <kbd className="rounded-sm border border-line-strong bg-sheet px-1 font-sans text-xs font-semibold">]</kbd> to start at the first point.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => p.onStepPoint(-1)}>Previous point</Button>
          <Button onClick={() => p.onStepPoint(1)}>Next point</Button>
          {p.structureHidden ? null : <Button disabled={keys.length !== 1 || !!p.structureNote} onClick={p.onInsert}>Insert point after</Button>}
          {p.structureHidden ? null : <Button disabled={keys.length === 0 || !!p.structureNote} onClick={p.onDelete}>Delete {keys.length > 1 ? 'points' : 'point'}</Button>}
        </div>
        {p.structureNote && !p.structureHidden ? <p data-testid="locked" className="text-xs text-ink-soft">{p.structureNote}</p> : null}
        {p.curvesHidden ? null : (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Curve tools">
            <Button disabled={!p.canCurve || !!p.curvesNote} onClick={p.onCurve}>Make curve</Button>
            <Button disabled={!p.canStraighten || !!p.curvesNote} onClick={p.onStraighten}>Make line</Button>
            <Button disabled={!p.canSmooth || !!p.curvesNote} onClick={p.onSmooth}>Smooth point</Button>
            <Button disabled={!p.canFitCurves || !!p.curvesNote} onClick={p.onFitCurves}>Fit curves</Button>
          </div>
        )}
        {p.curvesNote && !p.curvesHidden ? <p data-testid="locked" className="text-xs text-ink-soft">{p.curvesNote}</p> : null}
      </Section>

      <Section id="gi-spacing" title="Spacing">
        <div className="flex flex-wrap gap-3">
          <NumberField label="Left bearing" value={p.left} min={-300} max={600} onCommit={p.onLeft} />
          <NumberField label="Right bearing" value={p.right} min={-300} max={600} onCommit={p.onRight} />
          <NumberField label="Advance width" value={p.advance} min={0} max={4000} onCommit={p.onAdvance} />
        </div>
        {p.mode === 'outline' ? (
          <p className="text-xs text-ink-soft">Changing a bearing moves the outline or the advance for this hand-edited glyph. The change is part of the working copy until you apply it.</p>
        ) : p.hasSpacingOverride ? (
          <button type="button" onClick={p.onFollowSpacing} className={link}>Follow automatic spacing</button>
        ) : (
          <p className="text-xs text-ink-soft">Following automatic spacing. Typing a value stores it as an override for this glyph.</p>
        )}
      </Section>

      {p.shapeHidden ? null : (
      <Section id="gi-shape" title="Shape settings for this glyph">
        {p.shapeNote ? (
          <p data-testid="locked" className="flex items-start gap-2 text-sm text-ink-soft"><span className="mt-0.5"><InfoIcon /></span>{p.shapeNote}{o?.params ? ' The settings already on this glyph are kept and still apply.' : ''}</p>
        ) : shapeLocked ? (
          <p className="flex items-start gap-2 text-sm text-ink-soft"><span className="mt-0.5"><InfoIcon /></span>{p.dirty ? 'Apply or discard your outline changes to use shape settings again.' : 'This outline is hand-edited, so shape settings do not apply. Reset it to the generated shape to use them.'}</p>
        ) : (
          <div className="grid gap-4">
            {PARAMS.map((q) => {
              const own = o?.params?.[q.key]
              const global = p.face.dna[q.key]
              return (
                <div key={q.key} className="grid gap-1">
                  <RangeField label={q.label} value={own ?? global} min={q.min} max={q.max} step={q.step} format={(v) => (q.step < 1 ? v.toFixed(2) : String(v))} defaultValue={global} onChange={(v) => p.onParam(q.key, v)} />
                  {own !== undefined ? <button type="button" onClick={() => p.onParam(q.key, undefined)} className={link}>Follow the global value ({global})</button> : <p className="text-xs text-ink-soft">Following the global value.</p>}
                </div>
              )
            })}
          </div>
        )}
      </Section>
      )}

      <Section id="gi-outline" title="Outline">
        <p className="text-sm text-ink-soft">{p.frozen ? 'Hand-edited outline. Global shape changes no longer reach this glyph.' : 'Generated from the design. Editing a point makes it a hand-edited outline.'}</p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!p.canReset} onClick={p.onReset}>Reset to generated shape</Button>
          {!p.frozen && !p.dirty ? <Button onClick={p.onLock}>Lock this outline</Button> : null}
        </div>
        <p className="text-xs text-ink-soft">Reset is part of the working copy: undo it, or apply it to make the glyph follow the design again.</p>
        <div className="border-t border-line pt-3">
          <Button variant="danger" disabled={!p.hasOverrides} onClick={p.onResetAll}>Remove every override on this glyph</Button>
          <p className="mt-2 text-xs text-ink-soft">{p.hasOverrides ? 'Shape settings, spacing and the hand-edited outline. Global edits never remove overrides; only this button does.' : 'This glyph has no overrides.'}</p>
        </div>
      </Section>
    </div>
  )
}
