import type { Contour, Point } from '@/modules/brand-projects/schema'

/** Signed area (shoelace). In a y-up coordinate system, negative = clockwise. */
export function signedArea(contour: Contour): number {
  let sum = 0
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i]!
    const b = contour[(i + 1) % contour.length]!
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
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

export function contoursBounds(contours: Contour[]): Bounds | null {
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
  const n = contour.length
  if (n === 0) return ''
  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, onCurve: true })

  // Find a starting on-curve point (or synthesise one between two off-curve points).
  let startIdx = contour.findIndex((p) => p.onCurve)
  let start: Point
  let seq: Point[]
  if (startIdx === -1) {
    start = mid(contour[0]!, contour[1]!)
    seq = [...contour.slice(1), contour[0]!]
  } else {
    start = contour[startIdx]!
    seq = [...contour.slice(startIdx + 1), ...contour.slice(0, startIdx)]
  }
  startIdx = 0

  let d = `M${f(start.x)} ${f(start.y)}`
  let i = 0
  while (i < seq.length) {
    const p = seq[i]!
    if (p.onCurve) {
      d += `L${f(p.x)} ${f(p.y)}`
      i += 1
    } else {
      const next = seq[i + 1]
      if (next === undefined) {
        d += `Q${f(p.x)} ${f(p.y)} ${f(start.x)} ${f(start.y)}`
        i += 1
      } else if (next.onCurve) {
        d += `Q${f(p.x)} ${f(p.y)} ${f(next.x)} ${f(next.y)}`
        i += 2
      } else {
        const m = mid(p, next)
        d += `Q${f(p.x)} ${f(p.y)} ${f(m.x)} ${f(m.y)}`
        i += 1
      }
    }
  }
  return `${d}Z`
}

export const glyphToSvgPath = (contours: Contour[]) => contours.map(contourToSvgPath).join('')
