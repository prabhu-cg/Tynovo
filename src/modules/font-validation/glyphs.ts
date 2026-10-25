import type { Contour, FontMetrics, Glyph } from '../brand-projects/schema'
import { findIntersections } from '../typeface-engine/geometry/clean'
import { area } from '../typeface-engine/geometry/soften'
import type { Pt } from '../typeface-engine/geometry/shapes'

export type Severity = 'error' | 'warning' | 'info'

export interface GlyphIssue {
  severity: Severity
  code: string
  message: string
  char: string
}

function pointInContour(x: number, y: number, c: Contour): boolean {
  let inside = false
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const a = c[i]!
    const b = c[j]!
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

const asRing = (c: Contour): Pt[] => c.map((p) => [p.x, p.y])

/** How many other contours enclose this one: 0 = outer, 1 = counter, 2 = island inside a counter... */
export function nestingDepths(contours: Contour[]): number[] {
  return contours.map((c, i) => {
    const probe = c[0]!
    return contours.reduce((d, other, j) => (j !== i && pointInContour(probe.x, probe.y, other) ? d + 1 : d), 0)
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

  const areas = glyph.contours.map((c) => area(asRing(c)))
  glyph.contours.forEach((_, ci) => {
    if (Math.abs(areas[ci]!) < 1) add('error', 'glyph.zero-area', `Contour ${ci + 1} has no area.`)
  })

  if (findIntersections(glyph.contours).length > 0) {
    add('error', 'glyph.self-intersection', 'The outline crosses or touches itself.')
  }

  const depths = nestingDepths(glyph.contours)
  glyph.contours.forEach((c, ci) => {
    const clockwise = areas[ci]! < 0
    const wantClockwise = depths[ci]! % 2 === 0
    if (clockwise !== wantClockwise) {
      add('error', 'glyph.winding', `Contour ${ci + 1} runs the wrong way (outer contours clockwise, counters counter-clockwise).`)
    }
    if (depths[ci]! % 2 === 1 && !c.every((p) => glyph.contours.some((o, j) => j !== ci && pointInContour(p.x, p.y, o)))) {
      add('error', 'glyph.counter-outside', `Counter ${ci + 1} is not fully inside solid area.`)
    }
  })

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const c of glyph.contours)
    for (const p of c) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
  if (maxY > m.ascender + 1 || minY < m.descender - 1) {
    add('error', 'glyph.outside-metrics', `Outline spans ${minY} to ${maxY} but the font's vertical metrics are ${m.descender} to ${m.ascender}.`)
  }
  if (minX < 0) add('warning', 'glyph.negative-bearing', `Left side bearing is ${minX}: the outline starts left of the origin.`)
  if (glyph.advanceWidth < maxX) add('warning', 'glyph.overhang', `Outline extends ${maxX - glyph.advanceWidth} units past the advance width.`)
  if (glyph.advanceWidth <= 0 && visible) add('error', 'glyph.zero-advance', 'Visible glyph has zero advance width.')
  return issues
}
