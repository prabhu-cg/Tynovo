import type { Contour, Point } from '@/modules/brand-projects/schema'
import { pointOn, type Segment, type XY } from './geometry'
import { clampX, clampY, EMPTY_SELECTION, type OutlineResult, type Selection } from './outline'

/**
 * Fit curves to an outline: runs of short straight segments that together draw a smooth bend (the arcs of a
 * generated round letter) become a few quadratic curves, and long straight edges stay straight. The curve stays
 * within `tolerance` font units of the points it replaces, so the shape is the same to the eye and the glyph has
 * far fewer points to edit. Corners (a turn sharper than `CORNER_DEGREES`) are never smoothed over.
 */
export const FIT_TOLERANCE = 1.5
const CORNER_DEGREES = 32

const sub = (a: XY, b: XY): XY => ({ x: a.x - b.x, y: a.y - b.y })
const len = (v: XY) => Math.hypot(v.x, v.y)

/** Distance from a point to a line segment. */
function distToSegment(p: XY, a: XY, b: XY): number {
  const d = sub(b, a)
  const l2 = d.x * d.x + d.y * d.y
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / l2))
  return Math.hypot(a.x + d.x * t - p.x, a.y + d.y * t - p.y)
}

/** Distance from a point to a quadratic curve, searched along 40 pieces. */
function distToQuad(p: XY, seg: Segment): number {
  let best = Infinity
  let prev = pointOn(seg, 0)
  for (let k = 1; k <= 40; k++) {
    const cur = pointOn(seg, k / 40)
    best = Math.min(best, distToSegment(p, prev, cur))
    prev = cur
  }
  return best
}

/** The corner test: the direction changes by more than CORNER_DEGREES between the segment into a point and the one out of it. */
function isCorner(prev: XY, at: XY, next: XY): boolean {
  const a = sub(at, prev)
  const b = sub(next, at)
  const la = len(a)
  const lb = len(b)
  if (la === 0 || lb === 0) return false
  const cos = (a.x * b.x + a.y * b.y) / (la * lb)
  return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI) > CORNER_DEGREES
}

/**
 * The control point that makes a quadratic curve from `a` to `b` pass as near as possible to `pts` (least squares),
 * with each point's position along the curve found from its chord length and then refined by projecting onto the curve.
 */
function leastSquaresControl(pts: XY[]): XY | null {
  const a = pts[0]!
  const b = pts[pts.length - 1]!
  const lengths = [0]
  for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1]! + len(sub(pts[i]!, pts[i - 1]!)))
  const total = lengths[lengths.length - 1]!
  if (total === 0) return null
  let t = lengths.map((l) => l / total)
  let c: XY | null = null
  for (let round = 0; round < 4; round++) {
    let nx = 0
    let ny = 0
    let d = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const ti = t[i]!
      const u = 1 - ti
      const w = 2 * u * ti
      nx += w * (pts[i]!.x - u * u * a.x - ti * ti * b.x)
      ny += w * (pts[i]!.y - u * u * a.y - ti * ti * b.y)
      d += w * w
    }
    if (d < 1e-9) return null
    c = { x: nx / d, y: ny / d }
    // Where each point really falls along this curve, for the next round.
    const seg: Segment = { a, b, c, from: 0 }
    t = pts.map((q, i) => {
      if (i === 0) return 0
      if (i === pts.length - 1) return 1
      let bestT = t[i]!
      let best = Infinity
      for (let k = 0; k <= 40; k++) {
        const tk = k / 40
        const p = pointOn(seg, tk)
        const dd = (p.x - q.x) ** 2 + (p.y - q.y) ** 2
        if (dd < best) {
          best = dd
          bestT = tk
        }
      }
      return bestT
    })
  }
  return c
}

/** A line through all of `pts` within tolerance, or a quad fitted to them; null when neither is close enough. */
function fitRun(pts: XY[], tolerance: number): { c: XY | null } | null {
  const a = pts[0]!
  const b = pts[pts.length - 1]!
  if (pts.every((q) => distToSegment(q, a, b) <= tolerance)) return { c: null }
  if (pts.length < 3) return null
  const free = leastSquaresControl(pts)
  if (!free) return null
  const c: XY = { x: Math.round(free.x), y: Math.round(free.y) }
  if (Math.abs(c.x) > 6000 || Math.abs(c.y) > 6000) return null
  // The control point must lie ahead of both ends (a bend, not a back-and-forth) ...
  const t0 = sub(pts[1]!, a)
  const t1 = sub(b, pts[pts.length - 2]!)
  if ((c.x - a.x) * t0.x + (c.y - a.y) * t0.y <= 0 || (b.x - c.x) * t1.x + (b.y - c.y) * t1.y <= 0) return null
  const seg: Segment = { a, b, c, from: 0 }
  // ... and the curve must stay within tolerance of the points, and the points of the curve near the polyline.
  for (const q of pts) if (distToQuad(q, seg) > tolerance) return null
  for (let k = 1; k < 8; k++) {
    const m = pointOn(seg, k / 8)
    let near = Infinity
    for (let i = 0; i + 1 < pts.length; i++) near = Math.min(near, distToSegment(m, pts[i]!, pts[i + 1]!))
    if (near > tolerance * 1.5) return null
  }
  return { c }
}

/** Fit one all-on-curve contour. Returns null when nothing could be improved. */
function fitContour(contour: Contour, tolerance: number): Contour | null {
  const n = contour.length
  if (n < 4 || contour.some((p) => !p.onCurve)) return null
  const corner = contour.map((p, i) => isCorner(contour[(i - 1 + n) % n]!, p, contour[(i + 1) % n]!))
  // Begin at a corner when there is one, so no curve has to wrap around the start; otherwise the start itself is an anchor.
  const first = Math.max(0, corner.indexOf(true))
  const order = Array.from({ length: n }, (_, i) => (first + i) % n)
  const out: Point[] = []
  let s = 0
  let changed = false
  while (s < n) {
    // Extend the piece as far as one line or one curve will carry it, never over a corner.
    let best: { e: number; c: XY | null } | null = null
    for (let e = s + 1; e <= n; e++) {
      const run: XY[] = []
      for (let k = s; k <= e; k++) run.push(contour[order[k % n]!]!)
      const fit = fitRun(run, tolerance)
      if (!fit) break
      best = { e, c: fit.c }
      // A corner may end a piece but cannot be inside one.
      if (e < n && corner[order[e]!]) break
    }
    const piece = best ?? { e: s + 1, c: null }
    out.push(contour[order[s]!]!)
    if (piece.c) out.push({ x: clampX(piece.c.x), y: clampY(piece.c.y), onCurve: false })
    if (piece.e - s > 1) changed = true
    s = piece.e
  }
  return changed && out.length < n ? out : null
}

/**
 * Fit curves to the contours that contain the selection, or to every contour when nothing is selected. Contours
 * that already have curves are left as they are.
 */
export function fitCurves(contours: Contour[], selection: Selection, tolerance = FIT_TOLERANCE): OutlineResult {
  const chosen = new Set<number>()
  if (selection.size === 0) contours.forEach((_, i) => chosen.add(i))
  else for (const k of selection) chosen.add(Number(k.split(':')[0]))
  let saved = 0
  const next = contours.map((contour, ci) => {
    if (!chosen.has(ci)) return contour
    const fitted = fitContour(contour, tolerance)
    if (!fitted) return contour
    saved += contour.length - fitted.length
    return fitted
  })
  if (saved === 0) return { ok: false, reason: 'There are no runs of short straight segments to fit curves to.' }
  return { ok: true, contours: next, selection: EMPTY_SELECTION }
}
