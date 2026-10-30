import type { Contour, FontMetrics, Glyph } from '../brand-projects/schema'
import { contoursBounds, flattenContour, signedArea, type XY } from '../glyph-editor/geometry'
import { findIntersections } from '../typeface-engine/geometry/clean'

export type Severity = 'error' | 'warning' | 'info'

export interface GlyphIssue {
  severity: Severity
  code: string
  message: string
  char: string
}

function pointInRing(x: number, y: number, c: readonly XY[]): boolean {
  let inside = false
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const a = c[i]!
    const b = c[j]!
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Contours as polygons (curves flattened), so every geometric test below sees the shape that is drawn. */
const rings = (contours: Contour[]): XY[][] => contours.map((c) => flattenContour(c))

/** How many other contours enclose this one: 0 = outer, 1 = counter, 2 = island inside a counter... */
export function nestingDepths(contours: Contour[]): number[] {
  const polys = rings(contours)
  return polys.map((ring, i) => {
    const probe = ring[0]!
    return polys.reduce((d, other, j) => (j !== i && pointInRing(probe.x, probe.y, other) ? d + 1 : d), 0)
  })
}

const cache = new WeakMap<Glyph, Map<string, GlyphIssue[]>>()

/**
 * Geometric checks on one glyph. Pure. Results are memoised per glyph object and metrics, because the
 * generator hands back the same object while its inputs are unchanged.
 */
export function validateGlyph(glyph: Glyph, metrics: FontMetrics): GlyphIssue[] {
  const key = `${metrics.ascender}|${metrics.descender}`
  const byMetrics = cache.get(glyph) ?? new Map<string, GlyphIssue[]>()
  const hit = byMetrics.get(key)
  if (hit) return hit
  const out = compute(glyph, metrics)
  byMetrics.set(key, out)
  cache.set(glyph, byMetrics)
  return out
}

function compute(glyph: Glyph, m: FontMetrics): GlyphIssue[] {
  const issues: GlyphIssue[] = []
  const char = glyph.char
  const add = (severity: Severity, code: string, message: string) => issues.push({ severity, code, message, char })
  const visible = char.trim() !== ''

  if (glyph.contours.length === 0) {
    if (visible) add('error', 'glyph.empty', 'A visible character has no outline.')
    return issues
  }

  for (const [ci, c] of glyph.contours.entries()) {
    if (c.length < 3) add('error', 'glyph.degenerate', `Contour ${ci + 1} has fewer than three points.`)
    for (const p of c) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        add('error', 'glyph.non-finite', `Contour ${ci + 1} contains a non-finite coordinate.`)
        return issues
      }
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) {
        add('error', 'glyph.fractional', `Contour ${ci + 1} has fractional coordinates; TrueType needs whole units.`)
        break
      }
    }
  }
  if (issues.some((i) => i.severity === 'error')) return issues

  const areas = glyph.contours.map((c) => signedArea(c))
  glyph.contours.forEach((_, ci) => {
    if (Math.abs(areas[ci]!) < 1) add('error', 'glyph.zero-area', `Contour ${ci + 1} has no area.`)
  })

  const polys = rings(glyph.contours)
  if (findIntersections(polys.map((ring) => ring.map((p) => ({ x: p.x, y: p.y, onCurve: true })))).length > 0) {
    add('error', 'glyph.self-intersection', 'The outline crosses or touches itself.')
  }

  const depths = nestingDepths(glyph.contours)
  glyph.contours.forEach((_, ci) => {
    const clockwise = areas[ci]! < 0
    const wantClockwise = depths[ci]! % 2 === 0
    if (clockwise !== wantClockwise) {
      add('error', 'glyph.winding', `Contour ${ci + 1} runs the wrong way (outer contours clockwise, counters counter-clockwise).`)
    }
    if (depths[ci]! % 2 === 1 && !polys[ci]!.every((p) => polys.some((o, j) => j !== ci && pointInRing(p.x, p.y, o)))) {
      add('error', 'glyph.counter-outside', `Counter ${ci + 1} is not fully inside solid area.`)
    }
  })

  // Where the ink reaches: curves are measured at their turning points, so a control point beyond the metrics is not an error by itself.
  const bounds = contoursBounds(glyph.contours)!
  const { minX, maxX, minY, maxY } = bounds
  if (maxY > m.ascender + 1 || minY < m.descender - 1) {
    add('error', 'glyph.outside-metrics', `Outline spans ${minY} to ${maxY} but the font's vertical metrics are ${m.descender} to ${m.ascender}.`)
  }
  if (minX < 0) add('warning', 'glyph.negative-bearing', `Left side bearing is ${minX}: the outline starts left of the origin.`)
  if (glyph.advanceWidth < maxX) add('warning', 'glyph.overhang', `Outline extends ${maxX - glyph.advanceWidth} units past the advance width.`)
  if (glyph.advanceWidth <= 0 && visible) add('error', 'glyph.zero-advance', 'Visible glyph has zero advance width.')
  return issues
}
