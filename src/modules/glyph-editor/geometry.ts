import type { Contour } from '@/modules/brand-projects/schema'

/** Signed area (shoelace) of a polygon. In a y-up coordinate system, negative = clockwise. */
function polygonArea(pts: ReadonlyArray<{ x: number; y: number }>): number {
  let sum = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

const hasCurves = (contour: Contour) => contour.some((p) => !p.onCurve)

/** Signed area of a contour; curved contours are measured along their flattened curves. */
export function signedArea(contour: Contour): number {
  return polygonArea(hasCurves(contour) ? flattenContour(contour, AREA_STEPS) : contour)
}

export const isClockwise = (c: Contour) => signedArea(c) < 0

export function reverseContour(c: Contour): Contour {
  return [...c].reverse()
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Line pieces per curve when measuring area, finding crossings and testing containment: fine enough that the flattening error is far below one font unit. */
export const AREA_STEPS = 32

/* ---------- segments: lines and quadratic curves, TrueType rules ---------- */

export interface XY {
  x: number
  y: number
}

/** One drawn piece of a contour: a straight line a to b, or (when `c` is given) a quadratic curve from a to b pulled towards c. */
export interface Segment {
  a: XY
  b: XY
  c?: XY
  /** Index, in the contour, of the point this piece starts at: its on-curve start, or the off-curve point that follows an implied one. */
  from: number
}

const mid = (a: XY, b: XY): XY => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/**
 * The pieces of a contour, closed. Off-curve points are quadratic control points; two off-curve points in a row
 * imply an on-curve point halfway between them, and a contour with no on-curve point starts at such a midpoint.
 */
export function contourSegments(contour: Contour): Segment[] {
  const n = contour.length
  if (n === 0) return []
  const first = contour.findIndex((p) => p.onCurve)
  // The walk starts at an on-curve point, real or implied, and visits the rest of the contour once around.
  const start: XY = first === -1 ? mid(contour[0]!, contour[1 % n]!) : contour[first]!
  const order = first === -1 ? Array.from({ length: n }, (_, i) => (i + 1) % n) : Array.from({ length: n - 1 }, (_, i) => (first + 1 + i) % n)
  const out: Segment[] = []
  let at = start
  let from = first === -1 ? 0 : first
  let i = 0
  while (i < order.length) {
    const idx = order[i]!
    const p = contour[idx]!
    if (p.onCurve) {
      out.push({ a: at, b: p, from })
      at = p
      from = idx
      i += 1
      continue
    }
    const nextIdx = order[i + 1]
    const next = nextIdx === undefined ? undefined : contour[nextIdx]
    if (next === undefined) {
      out.push({ a: at, b: start, c: p, from })
      at = start
      i += 1
    } else if (next.onCurve) {
      out.push({ a: at, b: next, c: p, from })
      at = next
      from = nextIdx!
      i += 2
    } else {
      const m = mid(p, next)
      out.push({ a: at, b: m, c: p, from })
      at = m
      from = idx
      i += 1
    }
  }
  if (at !== start && (at.x !== start.x || at.y !== start.y)) out.push({ a: at, b: start, from })
  return out
}

/** The point at parameter t of a segment. */
export function pointOn(seg: Segment, t: number): XY {
  if (!seg.c) return { x: seg.a.x + (seg.b.x - seg.a.x) * t, y: seg.a.y + (seg.b.y - seg.a.y) * t }
  const u = 1 - t
  return { x: u * u * seg.a.x + 2 * u * t * seg.c.x + t * t * seg.b.x, y: u * u * seg.a.y + 2 * u * t * seg.c.y + t * t * seg.b.y }
}

/** A contour as a polygon: lines stay lines, each curve becomes `steps` short lines. The closing point is not repeated. */
export function flattenContour(contour: Contour, steps = AREA_STEPS): XY[] {
  const segs = contourSegments(contour)
  if (segs.length === 0) return []
  const out: XY[] = [{ x: segs[0]!.a.x, y: segs[0]!.a.y }]
  segs.forEach((seg, i) => {
    const last = i === segs.length - 1
    if (!seg.c) {
      if (!last) out.push({ x: seg.b.x, y: seg.b.y })
      return
    }
    const to = last ? steps - 1 : steps
    for (let k = 1; k <= to; k++) out.push(pointOn(seg, k / steps))
  })
  return out
}

/** The parameter values in (0, 1) where a quadratic curve turns around on one axis. */
const turns = (a: number, c: number, b: number): number[] => {
  const d = a - 2 * c + b
  if (d === 0) return []
  const t = (a - c) / d
  return t > 0 && t < 1 ? [t] : []
}

export function contoursBounds(contours: Contour[]): Bounds | null {
  let b: Bounds | null = null
  const add = (x: number, y: number) => {
    b = b ? { minX: Math.min(b.minX, x), minY: Math.min(b.minY, y), maxX: Math.max(b.maxX, x), maxY: Math.max(b.maxY, y) } : { minX: x, minY: y, maxX: x, maxY: y }
  }
  for (const contour of contours) {
    if (!hasCurves(contour)) {
      for (const p of contour) add(p.x, p.y)
      continue
    }
    // Where the ink really reaches: the on-curve points and the turning points of every curve, not the control points.
    for (const seg of contourSegments(contour)) {
      add(seg.a.x, seg.a.y)
      add(seg.b.x, seg.b.y)
      if (seg.c) for (const t of [...turns(seg.a.x, seg.c.x, seg.b.x), ...turns(seg.a.y, seg.c.y, seg.b.y)]) {
        const p = pointOn(seg, t)
        add(p.x, p.y)
      }
    }
  }
  return b
}

/** The box around every point, control points included. This is what a TrueType glyph header records. */
export function controlBounds(contours: Contour[]): Bounds | null {
  let b: Bounds | null = null
  for (const c of contours) {
    for (const p of c) {
      b = b
        ? { minX: Math.min(b.minX, p.x), minY: Math.min(b.minY, p.y), maxX: Math.max(b.maxX, p.x), maxY: Math.max(b.maxY, p.y) }
        : { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y }
    }
  }
  return b
}

const f = (n: number) => String(Math.round(n * 100) / 100)

/**
 * Convert a TrueType-style point contour (quadratic, implied on-curve midpoints)
 * to an SVG path string in y-up font units. Callers flip Y via the SVG transform.
 */
export function contourToSvgPath(contour: Contour): string {
  const segs = contourSegments(contour)
  if (segs.length === 0) return ''
  const start = segs[0]!.a
  let d = `M${f(start.x)} ${f(start.y)}`
  segs.forEach((seg, i) => {
    if (seg.c) d += `Q${f(seg.c.x)} ${f(seg.c.y)} ${f(seg.b.x)} ${f(seg.b.y)}`
    else if (!(i === segs.length - 1 && seg.b.x === start.x && seg.b.y === start.y)) d += `L${f(seg.b.x)} ${f(seg.b.y)}`
  })
  return `${d}Z`
}

export const glyphToSvgPath = (contours: Contour[]) => contours.map(contourToSvgPath).join('')
