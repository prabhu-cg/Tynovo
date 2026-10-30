import type { Contour } from '@/modules/brand-projects/schema'
import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { validateGlyph } from '@/modules/font-validation/glyphs'
import { deriveMetrics } from '@/modules/typeface-engine/dna'
import { createTypeface } from '@/modules/typeface-engine/typeface'
import { flattenContour, signedArea, isClockwise, type XY } from './geometry'
import { fitCurves } from './fit'

const on = (x: number, y: number) => ({ x, y, onCurve: true })
/** A clockwise polygon approximating a circle of radius r with n points. */
const circle = (r: number, n: number, cx = 0, cy = 0): Contour => Array.from({ length: n }, (_, i) => {
  const a = -(2 * Math.PI * i) / n
  return on(Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)))
})

function dist(p: XY, poly: XY[]): number {
  let d = Infinity
  poly.forEach((q, i) => {
    const r = poly[(i + 1) % poly.length]!
    const dx = r.x - q.x
    const dy = r.y - q.y
    const t = Math.max(0, Math.min(1, ((p.x - q.x) * dx + (p.y - q.y) * dy) / (dx * dx + dy * dy || 1)))
    d = Math.min(d, Math.hypot(q.x + t * dx - p.x, q.y + t * dy - p.y))
  })
  return d
}
/** The largest gap between two outlines, measured both ways. */
const drift = (a: Contour, b: Contour) => {
  const A = flattenContour(a, 64)
  const B = flattenContour(b, 64)
  return Math.max(...A.map((p) => dist(p, B)), ...B.map((p) => dist(p, A)))
}

describe('fitCurves', () => {
  it('replaces the many short sides of a round polygon with a few curves that stay within tolerance of it', () => {
    const poly = circle(300, 72)
    const r = fitCurves([poly], new Set())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const fitted = r.contours[0]!
    expect(fitted.length).toBeLessThan(poly.length / 3) // 72 sides become a handful of curves
    expect(fitted.some((p) => !p.onCurve)).toBe(true)
    expect(drift(fitted, poly)).toBeLessThan(3) // 1.5 tolerance plus rounding to whole units and the polygon's own facets
    expect(isClockwise(fitted)).toBe(true) // winding is kept
    expect(Math.abs(signedArea(fitted) - signedArea(poly)) / Math.abs(signedArea(poly))).toBeLessThan(0.01)
  })

  it('never smooths a real corner: a rectangle stays four points and no curves are made', () => {
    const rect: Contour = [on(0, 0), on(0, 700), on(90, 700), on(90, 0)]
    expect(fitCurves([rect], new Set())).toMatchObject({ ok: false })
  })

  it('keeps long straight edges straight and curves only the bends: a rounded rectangle', () => {
    // A 400 x 200 box whose corners are quarter-circle arcs of radius 60, drawn as short straight sides, clockwise.
    const pts: Contour = []
    const arc = (cx: number, cy: number, from: number) => {
      for (let k = 0; k <= 8; k++) {
        const a = ((from - (k * 90) / 8) * Math.PI) / 180
        pts.push(on(Math.round(cx + 60 * Math.cos(a)), Math.round(cy + 60 * Math.sin(a))))
      }
    }
    arc(60, 140, 180) // top-left, going from the left side up to the top
    arc(340, 140, 90) // top-right
    arc(340, 60, 0) // bottom-right
    arc(60, 60, 270) // bottom-left
    const r = fitCurves([pts], new Set())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const fitted = r.contours[0]!
    expect(fitted.length).toBeLessThanOrEqual(16)
    expect(drift(fitted, pts)).toBeLessThan(3)
    // The straight edges survive as lines: no control point lies on the middle of a side.
    const controls = fitted.filter((p) => !p.onCurve)
    expect(controls.every((c) => !(c.x > 120 && c.x < 280 && (c.y === 0 || c.y === 200)))).toBe(true)
  })

  it('only fits the contours that hold the selection, and leaves curved contours alone', () => {
    const a = circle(300, 72)
    const b = circle(100, 48, 1000, 0)
    const only = fitCurves([a, b], new Set(['1:0']))
    expect(only.ok && only.contours[0]).toBe(a) // untouched: same object
    expect(only.ok && only.contours[1]!.length).toBeLessThan(48)
    const again = fitCurves(only.ok ? [only.contours[1]!] : [], new Set())
    expect(again).toMatchObject({ ok: false }) // a contour that already has curves is left as it is
  })

  it('is deterministic', () => {
    const a = fitCurves([circle(250, 60)], new Set())
    const b = fitCurves([circle(250, 60)], new Set())
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('produces glyphs that still pass every check: round letters of every family, fitted', () => {
    for (const family of ['geometric', 'rounded', 'modular'] as const) {
      const face = createTypeface('f', family)
      const metrics = deriveMetrics(face.dna)
      const analysis = analyzeTypeface(face)
      for (const ch of 'OCSQGBDPRUacdegopqsu0368%&@') {
        const glyph = analysis.reports.get(ch)!.glyph!
        const r = fitCurves(glyph.contours, new Set())
        if (!r.ok) continue
        const fitted = { ...glyph, contours: r.contours }
        const errors = validateGlyph(fitted, metrics).filter((i) => i.severity === 'error')
        expect(errors, `${family} ${ch}: ${errors.map((e) => e.message).join('; ')}`).toEqual([])
        // Many fewer points, and the shape within a couple of units of the original.
        expect(r.contours.flat().length).toBeLessThan(glyph.contours.flat().length)
        glyph.contours.forEach((c, i) => expect(drift(r.contours[i]!, c), `${family} ${ch} contour ${i}`).toBeLessThan(4))
      }
    }
  })
})
