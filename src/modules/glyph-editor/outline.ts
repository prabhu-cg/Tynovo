import type { Contour, Point } from '@/modules/brand-projects/schema'
import { nestingDepths } from '@/modules/font-validation/glyphs'
import { signedArea } from './geometry'

/**
 * Pure outline operations for the point editor. Contours are closed polygons of whole-unit points, y up.
 * Every function returns new arrays and leaves its input untouched; contours that did not change keep their
 * identity, so React and memoised validation can skip them.
 *
 * Scope: the engine's geometry model is polylines (on-curve points only), so the editor moves, inserts and
 * deletes straight-segment points. It is not a Bézier editor, and does not need to be.
 */

/** Coordinates are clamped so a stray drag or typo cannot produce a font that no tool can open. */
export const X_LIMIT = { min: -1000, max: 4000 }
export const Y_LIMIT = { min: -1500, max: 2500 }

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
export const clampX = (x: number) => clamp(Math.round(x), X_LIMIT.min, X_LIMIT.max)
export const clampY = (y: number) => clamp(Math.round(y), Y_LIMIT.min, Y_LIMIT.max)

/** `contour:point` identifies a point; used as the selection key. */
export const pointKey = (c: number, p: number) => `${c}:${p}`
export function parseKey(key: string): { c: number; p: number } {
  const [c, p] = key.split(':')
  return { c: Number(c), p: Number(p) }
}

export type Selection = ReadonlySet<string>
export const EMPTY_SELECTION: Selection = new Set<string>()

export const sameContours = (a: Contour[], b: Contour[]) =>
  a === b || (a.length === b.length && a.every((c, i) => c === b[i] || (c.length === b[i]!.length && c.every((p, j) => p.x === b[i]![j]!.x && p.y === b[i]![j]!.y && p.onCurve === b[i]![j]!.onCurve))))

export const pointCount = (contours: Contour[]) => contours.reduce((n, c) => n + c.length, 0)

export function allKeys(contours: Contour[]): Set<string> {
  const keys = new Set<string>()
  contours.forEach((c, ci) => c.forEach((_, pi) => keys.add(pointKey(ci, pi))))
  return keys
}

export function contourKeys(contours: Contour[], ci: number): Set<string> {
  return new Set((contours[ci] ?? []).map((_, pi) => pointKey(ci, pi)))
}

/** Drop keys that no longer point at a point (after a delete or an undo). */
export function validSelection(contours: Contour[], selection: Selection): Selection {
  const kept = [...selection].filter((k) => {
    const { c, p } = parseKey(k)
    return contours[c] !== undefined && contours[c]![p] !== undefined
  })
  return kept.length === selection.size ? selection : new Set(kept)
}

/* ---------- moving ---------- */

/** Move the selected points by a whole-unit offset. Each point is clamped separately. */
export function movePoints(contours: Contour[], selection: Selection, dx: number, dy: number): Contour[] {
  if (selection.size === 0 || (dx === 0 && dy === 0)) return contours
  const byContour = new Map<number, Set<number>>()
  for (const k of selection) {
    const { c, p } = parseKey(k)
    byContour.set(c, (byContour.get(c) ?? new Set()).add(p))
  }
  return contours.map((contour, ci) => {
    const moving = byContour.get(ci)
    if (!moving) return contour
    return contour.map((pt, pi) => (moving.has(pi) ? { ...pt, x: clampX(pt.x + dx), y: clampY(pt.y + dy) } : pt))
  })
}

/** Put one point at an exact position (typed coordinates). */
export function setPoint(contours: Contour[], c: number, p: number, x: number, y: number): Contour[] {
  const pt = contours[c]?.[p]
  if (!pt) return contours
  const nx = clampX(x)
  const ny = clampY(y)
  if (pt.x === nx && pt.y === ny) return contours
  return contours.map((contour, ci) => (ci === c ? contour.map((q, pi) => (pi === p ? { ...q, x: nx, y: ny } : q)) : contour))
}

export function translate(contours: Contour[], dx: number, dy: number): Contour[] {
  return movePoints(contours, allKeys(contours), dx, dy)
}

/* ---------- inserting and deleting ---------- */

export type OutlineResult = { ok: true; contours: Contour[]; selection: Selection } | { ok: false; reason: string }

/** Add a point halfway along the segment that starts at (c, p). Refuses when the segment is too short to split in whole units. */
export function insertPointAfter(contours: Contour[], c: number, p: number): OutlineResult {
  const contour = contours[c]
  const a = contour?.[p]
  const b = contour?.[(p + 1) % (contour?.length ?? 1)]
  if (!contour || !a || !b) return { ok: false, reason: 'There is no segment there.' }
  const mid: Point = { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2), onCurve: true }
  if ((mid.x === a.x && mid.y === a.y) || (mid.x === b.x && mid.y === b.y)) return { ok: false, reason: 'That segment is too short to split in whole units.' }
  return insertAt(contours, c, p, mid)
}

/** Insert a point at a position on a segment (for double-click). The position is snapped onto the segment. */
export function insertPointAt(contours: Contour[], c: number, p: number, x: number, y: number): OutlineResult {
  const contour = contours[c]
  const a = contour?.[p]
  const b = contour?.[(p + 1) % (contour?.length ?? 1)]
  if (!contour || !a || !b) return { ok: false, reason: 'There is no segment there.' }
  const projected = projectOnSegment(a, b, x, y)
  const pt: Point = { x: Math.round(projected.x), y: Math.round(projected.y), onCurve: true }
  if ((pt.x === a.x && pt.y === a.y) || (pt.x === b.x && pt.y === b.y)) return insertPointAfter(contours, c, p)
  return insertAt(contours, c, p, pt)
}

function insertAt(contours: Contour[], c: number, p: number, pt: Point): OutlineResult {
  const next = contours.map((contour, ci) => (ci === c ? [...contour.slice(0, p + 1), pt, ...contour.slice(p + 1)] : contour))
  return { ok: true, contours: next, selection: new Set([pointKey(c, p + 1)]) }
}

/**
 * Delete the selected points. A contour must keep at least three points, so deleting some of a small
 * contour's points is refused; selecting every point of a contour removes the whole contour.
 */
export function deletePoints(contours: Contour[], selection: Selection): OutlineResult {
  if (selection.size === 0) return { ok: false, reason: 'Select a point first.' }
  const doomed = new Map<number, Set<number>>()
  for (const k of selection) {
    const { c, p } = parseKey(k)
    if (contours[c]?.[p]) doomed.set(c, (doomed.get(c) ?? new Set()).add(p))
  }
  const next: Contour[] = []
  for (const [ci, contour] of contours.entries()) {
    const gone = doomed.get(ci)
    if (!gone) {
      next.push(contour)
      continue
    }
    if (gone.size === contour.length) continue // the whole contour was selected: remove it
    const kept = contour.filter((_, pi) => !gone.has(pi))
    if (kept.length < 3) return { ok: false, reason: 'A contour needs at least three points. Select all of its points to remove the whole contour.' }
    next.push(kept)
  }
  return { ok: true, contours: next, selection: EMPTY_SELECTION }
}

/* ---------- picking ---------- */

export function projectOnSegment(a: Point, b: Point, x: number, y: number): { x: number; y: number; t: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : clamp(((x - a.x) * dx + (y - a.y) * dy) / len2, 0, 1)
  return { x: a.x + t * dx, y: a.y + t * dy, t }
}

export interface SegmentHit {
  c: number
  /** Index of the segment's first point; the segment runs to the next point (wrapping). */
  p: number
  distance: number
}

/** Closest segment to a position, within `maxDistance` font units. */
export function nearestSegment(contours: Contour[], x: number, y: number, maxDistance: number): SegmentHit | null {
  let best: SegmentHit | null = null
  contours.forEach((contour, c) => {
    contour.forEach((a, p) => {
      const b = contour[(p + 1) % contour.length]!
      const q = projectOnSegment(a, b, x, y)
      const d = Math.hypot(q.x - x, q.y - y)
      if (d <= maxDistance && (!best || d < best.distance)) best = { c, p, distance: d }
    })
  })
  return best
}

export function nearestPoint(contours: Contour[], x: number, y: number, maxDistance: number): { c: number; p: number; distance: number } | null {
  let best: { c: number; p: number; distance: number } | null = null
  contours.forEach((contour, c) =>
    contour.forEach((pt, p) => {
      const d = Math.hypot(pt.x - x, pt.y - y)
      if (d <= maxDistance && (!best || d < best.distance)) best = { c, p, distance: d }
    }),
  )
  return best
}

export function pointsInRect(contours: Contour[], x1: number, y1: number, x2: number, y2: number): Set<string> {
  const [minX, maxX] = [Math.min(x1, x2), Math.max(x1, x2)]
  const [minY, maxY] = [Math.min(y1, y2), Math.max(y1, y2)]
  const keys = new Set<string>()
  contours.forEach((contour, c) => contour.forEach((pt, p) => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY && keys.add(pointKey(c, p))))
  return keys
}

/** Next / previous point in reading order across contours, wrapping around. */
export function stepPoint(contours: Contour[], from: { c: number; p: number } | null, direction: 1 | -1): { c: number; p: number } | null {
  const order = contours.flatMap((contour, c) => contour.map((_, p) => ({ c, p })))
  if (order.length === 0) return null
  if (!from) return direction === 1 ? order[0]! : order[order.length - 1]!
  const at = order.findIndex((o) => o.c === from.c && o.p === from.p)
  return order[(at + direction + order.length) % order.length]!
}

/** First point of the next / previous contour. */
export function stepContour(contours: Contour[], from: number | null, direction: 1 | -1): number | null {
  if (contours.length === 0) return null
  if (from === null) return direction === 1 ? 0 : contours.length - 1
  return (from + direction + contours.length) % contours.length
}

/* ---------- repairs ---------- */

/** Remove consecutive points that sit on top of each other (including the wrap-around pair). */
export function removeDuplicatePoints(contours: Contour[]): { contours: Contour[]; removed: number } {
  let removed = 0
  const next = contours.map((contour) => {
    const out: Point[] = []
    for (const pt of contour) {
      const last = out[out.length - 1]
      if (last && last.x === pt.x && last.y === pt.y) removed += 1
      else out.push(pt)
    }
    while (out.length > 1 && out[0]!.x === out[out.length - 1]!.x && out[0]!.y === out[out.length - 1]!.y) {
      out.pop()
      removed += 1
    }
    return out.length === contour.length ? contour : out
  })
  return { contours: next.filter((c) => c.length >= 3), removed }
}

/** Outer contours clockwise, counters counter-clockwise, decided by nesting depth. Reverses only the ones that are wrong. */
export function fixWinding(contours: Contour[]): { contours: Contour[]; reversed: number } {
  const depths = nestingDepths(contours)
  let reversed = 0
  const next = contours.map((c, i) => {
    const clockwise = signedArea(c) < 0
    const wantClockwise = depths[i]! % 2 === 0
    if (clockwise === wantClockwise) return c
    reversed += 1
    return [...c].reverse()
  })
  return { contours: next, reversed }
}

/** Largest x of the outline, 0 for an empty one. */
export const maxX = (contours: Contour[]) => contours.reduce((m, c) => c.reduce((mm, p) => Math.max(mm, p.x), m), 0)
export const minX = (contours: Contour[]) => {
  const xs = contours.flatMap((c) => c.map((p) => p.x))
  return xs.length === 0 ? 0 : Math.min(...xs)
}
