import type { Contour, Glyph } from '../brand-projects/schema'

/**
 * Measurements of the white space between neighbouring glyphs. Geometry only: it reports distances, it does not
 * judge taste. Everything here is in font units and works on the same outlines that go into the font.
 */

/** Horizontal ink extent of a glyph at height y: leftmost and rightmost inside-edge, or null where there is no ink. */
export function inkAt(contours: Contour[], y: number): { left: number; right: number } | null {
  let left = Infinity
  let right = -Infinity
  for (const c of contours) {
    for (let i = 0; i < c.length; i++) {
      const a = c[i]!
      const b = c[(i + 1) % c.length]!
      if (a.y === b.y) continue
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        const x = a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x)
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }
  return left === Infinity ? null : { left, right }
}

export interface PairGap {
  /** Smallest horizontal gap over all heights where both glyphs have ink. Negative means they overlap. */
  min: number
  /** Mean gap over those heights, each row capped at `cap`, so one deep notch (T, V) does not dominate. */
  mean: number
  /** Heights compared. Zero means the two glyphs never share a height (e.g. a hyphen next to a descender). */
  rows: number
}

const STEP = 8

/**
 * Gap between `left` and `right` placed side by side with `kern` added between them. Rows are sampled between
 * `yMin` and `yMax` (the band where both glyphs are normally drawn), offset by half a unit so a scan line never
 * runs exactly along a horizontal edge.
 */
export function pairGap(left: Glyph, right: Glyph, kern: number, yMin: number, yMax: number, cap: number): PairGap {
  let min = Infinity
  let sum = 0
  let rows = 0
  for (let y = yMin + 0.5; y < yMax; y += STEP) {
    const a = inkAt(left.contours, y)
    const b = inkAt(right.contours, y)
    if (!a || !b) continue
    const gap = left.advanceWidth + kern + b.left - a.right
    min = Math.min(min, gap)
    sum += Math.min(gap, cap)
    rows += 1
  }
  return rows === 0 ? { min: 0, mean: 0, rows: 0 } : { min, mean: sum / rows, rows }
}

export const median = (values: number[]): number => {
  if (values.length === 0) return 0
  const s = [...values].sort((x, y) => x - y)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}
