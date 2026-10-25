import type { Contour } from '@/modules/brand-projects/schema'
import { area } from './soften'
import type { Pt, Ring, Shape } from './shapes'

/** Smallest feature kept after rounding to whole units: contours with less area than this are dropped. */
export const MIN_CONTOUR_AREA = 6

const same = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1]

/** Round to integers, drop repeated points, collinear points and zero-width spikes. */
export function tidyRing(ring: Ring): Ring {
  let pts: Ring = ring.map(([x, y]) => [Math.round(x), Math.round(y)])
  if (pts.length > 1 && same(pts[0]!, pts[pts.length - 1]!)) pts = pts.slice(0, -1)
  const dedup: Ring = []
  for (const p of pts) if (dedup.length === 0 || !same(p, dedup[dedup.length - 1]!)) dedup.push(p)
  if (dedup.length > 1 && same(dedup[0]!, dedup[dedup.length - 1]!)) dedup.pop()
  // Remove points that lie on the straight line between their neighbours (exact test on integers).
  let changed = true
  let cur = dedup
  while (changed && cur.length > 3) {
    changed = false
    const next: Ring = []
    for (let i = 0; i < cur.length; i++) {
      const a = cur[(i + cur.length - 1) % cur.length]!
      const b = cur[i]!
      const c = cur[(i + 1) % cur.length]!
      const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
      // Collinear points are redundant; a collinear point where the path doubles back is a zero-width spike.
      if (cr === 0) changed = true
      else next.push(b)
    }
    cur = next
  }
  return cur
}

/**
 * Turn a Shape into TrueType contours: whole-unit coordinates, outer rings clockwise, holes counter-clockwise.
 * Anything too small to survive rounding is dropped (and counted by the caller through the returned area).
 */
export function shapeToContours(shape: Shape): Contour[] {
  const out: Contour[] = []
  for (const polygon of shape) {
    polygon.forEach((ring, i) => {
      const tidy = tidyRing(ring)
      if (tidy.length < 3 || Math.abs(area(tidy)) < MIN_CONTOUR_AREA) return
      const isHole = i > 0
      // y-up: positive area is counter-clockwise. Outer must be clockwise, holes counter-clockwise.
      const wantCcw = isHole
      const oriented = area(tidy) > 0 === wantCcw ? tidy : [...tidy].reverse()
      out.push(oriented.map(([x, y]) => ({ x, y, onCurve: true })))
    })
  }
  return out
}

/* ---------- validity ---------- */

type Seg = [Pt, Pt]

function orient(a: Pt, b: Pt, c: Pt) {
  const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  return v > 0 ? 1 : v < 0 ? -1 : 0
}
const onSeg = (a: Pt, b: Pt, p: Pt) =>
  Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1])

/** True when two segments share more than an endpoint of a shared vertex (proper crossing, touching or overlap). */
function segmentsConflict(s: Seg, t: Seg, adjacent: boolean): boolean {
  const [a, b] = s
  const [c, d] = t
  const o1 = orient(a, b, c)
  const o2 = orient(a, b, d)
  const o3 = orient(c, d, a)
  const o4 = orient(c, d, b)
  if (o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) return true // proper crossing
  if (adjacent) {
    // Neighbouring edges legitimately share one endpoint; they must not fold back over each other.
    const shared = same(b, c) ? b : same(a, d) ? a : null
    if (!shared) return false
    const other1 = same(shared, a) ? b : a
    const other2 = same(shared, c) ? d : c
    return orient(shared, other1, other2) === 0 && (other1[0] - shared[0]) * (other2[0] - shared[0]) + (other1[1] - shared[1]) * (other2[1] - shared[1]) > 0
  }
  // Non-adjacent edges must not touch at all.
  if (o1 === 0 && onSeg(a, b, c)) return true
  if (o2 === 0 && onSeg(a, b, d)) return true
  if (o3 === 0 && onSeg(c, d, a)) return true
  if (o4 === 0 && onSeg(c, d, b)) return true
  return false
}

/** Pairs of edge indices (within a set of contours) that cross or touch. Straight-edge test on on-curve points. */
export function findIntersections(contours: Contour[]): Array<{ a: [number, number]; b: [number, number] }> {
  const edges: Array<{ ci: number; ei: number; seg: Seg; n: number }> = []
  contours.forEach((c, ci) => {
    c.forEach((p, ei) => {
      const q = c[(ei + 1) % c.length]!
      edges.push({ ci, ei, seg: [[p.x, p.y], [q.x, q.y]], n: c.length })
    })
  })
  const found: Array<{ a: [number, number]; b: [number, number] }> = []
  const box = edges.map(({ seg: [p, q] }) => [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])] as const)
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!
    const bi = box[i]!
    for (let j = i + 1; j < edges.length; j++) {
      const bj = box[j]!
      // Cheap reject: segments whose bounding boxes do not even touch cannot intersect.
      if (bj[0] > bi[2] || bj[2] < bi[0] || bj[1] > bi[3] || bj[3] < bi[1]) continue
      const f = edges[j]!
      const adjacent = e.ci === f.ci && (f.ei === (e.ei + 1) % e.n || e.ei === (f.ei + 1) % f.n)
      if (segmentsConflict(e.seg, f.seg, adjacent)) found.push({ a: [e.ci, e.ei], b: [f.ci, f.ei] })
    }
  }
  return found
}
