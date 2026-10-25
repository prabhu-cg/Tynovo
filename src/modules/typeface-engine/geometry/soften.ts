import { arcPoints, type Pt, type Ring, type Shape } from './shapes'

export type CornerKind = 'round' | 'chamfer'

export interface SoftenOptions {
  kind: CornerKind
  /** Radius (round) or leg length (chamfer) for outside corners. */
  outside: number
  /** Same for inside (concave) corners. */
  inside: number
  /** Vertices that turn less than this many degrees are part of a curve and are left alone. */
  minTurnDeg?: number
  /** When set, only vertices for which this returns true are softened (used for terminal caps). */
  only?: (p: Pt) => boolean
}

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]]
const len = (v: Pt) => Math.hypot(v[0], v[1])
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0]

/** Signed area, positive when counter-clockwise (y up). */
export function area(ring: Ring): number {
  let s = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    s += a[0] * b[1] - b[0] * a[1]
  }
  return s / 2
}

/**
 * Round or chamfer the sharp vertices of a ring. Works on any ring; whether a vertex is an outside
 * or inside corner is decided from the ring's own winding, so holes are handled correctly.
 * Distances are clamped to half of each adjacent edge so neighbouring corners never overlap.
 */
export function softenRing(ring: Ring, o: SoftenOptions): Ring {
  const n = ring.length
  if (n < 3 || (o.outside <= 0 && o.inside <= 0)) return ring
  const ccw = area(ring) > 0
  const minTurn = ((o.minTurnDeg ?? 20) * Math.PI) / 180
  const out: Ring = []
  for (let i = 0; i < n; i++) {
    const v = ring[i]!
    if (o.only && !o.only(v)) {
      out.push(v)
      continue
    }
    const prev = ring[(i + n - 1) % n]!
    const next = ring[(i + 1) % n]!
    const toPrev = sub(prev, v)
    const toNext = sub(next, v)
    const lp = len(toPrev)
    const ln = len(toNext)
    if (lp < 1e-9 || ln < 1e-9) {
      out.push(v)
      continue
    }
    const u1: Pt = [toPrev[0] / lp, toPrev[1] / lp]
    const u2: Pt = [toNext[0] / ln, toNext[1] / ln]
    const dot = Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]))
    const phi = Math.acos(dot) // angle between the two edges at v
    const turn = Math.PI - phi
    if (turn < minTurn || phi < 1e-3) {
      out.push(v)
      continue
    }
    // Convex when the ring turns the same way as its winding.
    const turnsLeft = cross(sub(v, prev), sub(next, v)) > 0
    const convex = turnsLeft === ccw
    const size = convex ? o.outside : o.inside
    if (size <= 0) {
      out.push(v)
      continue
    }
    if (o.kind === 'chamfer') {
      const t = Math.min(size, lp / 2, ln / 2)
      out.push([v[0] + u1[0] * t, v[1] + u1[1] * t], [v[0] + u2[0] * t, v[1] + u2[1] * t])
      continue
    }
    // Fillet of radius `size`: tangent distance t = r / tan(phi / 2), clamped to half the edges.
    const tanHalf = Math.tan(phi / 2)
    let t = size / tanHalf
    t = Math.min(t, lp / 2, ln / 2)
    const r = t * tanHalf
    const p1: Pt = [v[0] + u1[0] * t, v[1] + u1[1] * t]
    const p2: Pt = [v[0] + u2[0] * t, v[1] + u2[1] * t]
    const bis: Pt = [u1[0] + u2[0], u1[1] + u2[1]]
    const bl = len(bis)
    const dist = r / Math.sin(phi / 2)
    const c: Pt = [v[0] + (bis[0] / bl) * dist, v[1] + (bis[1] / bl) * dist]
    const a1 = (Math.atan2(p1[1] - c[1], p1[0] - c[0]) * 180) / Math.PI
    let a2 = (Math.atan2(p2[1] - c[1], p2[0] - c[0]) * 180) / Math.PI
    // Take the short way round from p1 to p2.
    while (a2 - a1 > 180) a2 -= 360
    while (a2 - a1 < -180) a2 += 360
    const steps = Math.max(2, Math.ceil(Math.abs(a2 - a1) / 12))
    out.push(...arcPoints(c[0], c[1], r, r, a1, a2, steps))
  }
  return out
}

export function soften(shape: Shape, o: SoftenOptions): Shape {
  if (o.outside <= 0 && o.inside <= 0) return shape
  return shape.map((polygon) => polygon.map((r) => softenRing(r, o)))
}
