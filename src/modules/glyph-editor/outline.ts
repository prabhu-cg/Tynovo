import type { Contour, Point } from '@/modules/brand-projects/schema'
import { nestingDepths } from '@/modules/font-validation/glyphs'
import { contourSegments, contoursBounds, pointOn, signedArea } from './geometry'

/**
 * Pure outline operations for the point editor. Contours are closed polygons of whole-unit points, y up.
 * Every function returns new arrays and leaves its input untouched; contours that did not change keep their
 * identity, so React and memoised validation can skip them.
 *
 * Points are on-curve or off-curve. An off-curve point is the control point of a quadratic Bézier curve (the curve
 * type TrueType fonts use; OpenType/CFF export converts each one to a cubic with the same shape). A segment between
 * two on-curve points is a straight line when nothing lies between them and a curve when one control point does.
 * Two off-curve points in a row imply an on-curve point halfway between them; the operations that change segments
 * write that point out first (see `explicitContour`) so a segment is always a line or a single curve.
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

const midpoint = (a: Point, b: Point, onCurve: boolean): Point => ({ x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2), onCurve })
const samePlace = (a: Point, b: Point) => a.x === b.x && a.y === b.y

/**
 * A copy of a contour in which the on-curve point implied between two off-curve points is written out, so every
 * segment is a line or one curve. `map[i]` is where the original point i ended up. The shape is unchanged, up to
 * rounding the new points to whole units.
 */
export function explicitContour(contour: Contour): { contour: Contour; map: number[] } {
  const out: Point[] = []
  const map: number[] = []
  contour.forEach((pt, i) => {
    map.push(out.length)
    out.push(pt)
    const next = contour[(i + 1) % contour.length]!
    if (!pt.onCurve && !next.onCurve) out.push(midpoint(pt, next, true))
  })
  return { contour: out, map }
}

interface Span {
  /** Index of the on-curve point the span starts at. */
  start: number
  /** Index of the on-curve point it ends at (wrapping). */
  end: number
  /** The control point between them, or null for a straight line. */
  ctrl: number | null
}

/** The lines and curves of an explicit contour, in order. */
function spansOf(ex: Contour): Span[] {
  const n = ex.length
  const ons = ex.flatMap((pt, i) => (pt.onCurve ? [i] : []))
  return ons.map((start, k) => {
    const end = ons[(k + 1) % ons.length]!
    const steps = (end - start + n) % n || n
    return { start, end, ctrl: steps === 2 ? (start + 1) % n : null }
  })
}

/** The span a point belongs to for segment operations: an on-curve point starts one, an off-curve point is inside one. */
function spanFor(ex: Contour, spans: Span[], index: number): Span | undefined {
  return ex[index]?.onCurve ? spans.find((s) => s.start === index) : spans.find((s) => s.ctrl === index)
}

const TOO_SHORT = 'That segment is too short to split in whole units.'
const NO_SEGMENT = 'There is no segment there.'

/** Split the span at parameter t, with every new point on a whole unit. Returns the points that replace the span's control point (or nothing for a line). */
function splitSpan(ex: Contour, span: Span, t: number): { insert: Point[]; at: number; selectedOffset: number } | null {
  const a = ex[span.start]!
  const b = ex[span.end]!
  if (span.ctrl === null) {
    const m: Point = { x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t), onCurve: true }
    if (samePlace(m, a) || samePlace(m, b)) return null
    return { insert: [m], at: span.start + 1, selectedOffset: 0 }
  }
  const c = ex[span.ctrl]!
  // de Casteljau: the two halves of the curve share the new on-curve point M, and each has its own control point.
  const c1 = { x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t }
  const c2 = { x: c.x + (b.x - c.x) * t, y: c.y + (b.y - c.y) * t }
  const m: Point = { x: Math.round(c1.x + (c2.x - c1.x) * t), y: Math.round(c1.y + (c2.y - c1.y) * t), onCurve: true }
  if (samePlace(m, a) || samePlace(m, b)) return null
  return {
    insert: [{ x: Math.round(c1.x), y: Math.round(c1.y), onCurve: false }, m, { x: Math.round(c2.x), y: Math.round(c2.y), onCurve: false }],
    at: span.ctrl,
    selectedOffset: 1,
  }
}

/** Replace contour c, optionally dropping the control point the split replaces. */
function applySplit(contours: Contour[], c: number, ex: Contour, span: Span, split: { insert: Point[]; at: number; selectedOffset: number }): OutlineResult {
  const next = span.ctrl === null ? [...ex.slice(0, split.at), ...split.insert, ...ex.slice(split.at)] : [...ex.slice(0, split.at), ...split.insert, ...ex.slice(split.at + 1)]
  return { ok: true, contours: contours.map((contour, ci) => (ci === c ? next : contour)), selection: new Set([pointKey(c, split.at + split.selectedOffset)]) }
}

/**
 * Add a point halfway along the segment that starts at (c, p), or, when p is a control point, along the curve it
 * shapes. On a curve the new point is on the curve and the two halves keep its exact shape. Refuses when the segment is too short to split in whole units.
 */
export function insertPointAfter(contours: Contour[], c: number, p: number): OutlineResult {
  const contour = contours[c]
  if (!contour || !contour[p]) return { ok: false, reason: NO_SEGMENT }
  const { contour: ex, map } = explicitContour(contour)
  const span = spanFor(ex, spansOf(ex), map[p]!)
  if (!span) return { ok: false, reason: NO_SEGMENT }
  const split = splitSpan(ex, span, 0.5)
  return split ? applySplit(contours, c, ex, span, split) : { ok: false, reason: TOO_SHORT }
}

/** Insert a point at a position on a segment (for double-click). The position is snapped onto the line or curve. */
export function insertPointAt(contours: Contour[], c: number, _p: number, x: number, y: number): OutlineResult {
  const contour = contours[c]
  if (!contour) return { ok: false, reason: NO_SEGMENT }
  const { contour: ex } = explicitContour(contour)
  const spans = spansOf(ex)
  // Which span is nearest, and where along it: found on the explicit contour so that a chain of curves is split in the right piece.
  let best: { span: Span; t: number; d: number } | null = null
  for (const span of spans) {
    const hit = nearestOnSpan(ex, span, x, y)
    if (!best || hit.d < best.d) best = { span, t: hit.t, d: hit.d }
  }
  if (!best) return { ok: false, reason: NO_SEGMENT }
  const split = splitSpan(ex, best.span, best.t) ?? splitSpan(ex, best.span, 0.5)
  return split ? applySplit(contours, c, ex, best.span, split) : { ok: false, reason: TOO_SHORT }
}

/** Closest point of one line or curve to (x, y): its parameter and distance. Curves are searched along 48 pieces, then refined. */
function nearestOnSpan(ex: Contour, span: Span, x: number, y: number): { t: number; d: number } {
  const a = ex[span.start]!
  const b = ex[span.end]!
  if (span.ctrl === null) {
    const q = projectOnSegment(a, b, x, y)
    return { t: q.t, d: Math.hypot(q.x - x, q.y - y) }
  }
  const seg = { a, b, c: ex[span.ctrl]!, from: span.start }
  let bestT = 0
  let bestD = Infinity
  const N = 48
  for (let k = 0; k <= N; k++) {
    const q = pointOn(seg, k / N)
    const d = Math.hypot(q.x - x, q.y - y)
    if (d < bestD) {
      bestD = d
      bestT = k / N
    }
  }
  // Refine around the best sample by halving the search window.
  let lo = Math.max(0, bestT - 1 / N)
  let hi = Math.min(1, bestT + 1 / N)
  for (let i = 0; i < 12; i++) {
    const t1 = lo + (hi - lo) / 3
    const t2 = hi - (hi - lo) / 3
    const q1 = pointOn(seg, t1)
    const q2 = pointOn(seg, t2)
    if (Math.hypot(q1.x - x, q1.y - y) < Math.hypot(q2.x - x, q2.y - y)) hi = t2
    else lo = t1
  }
  const t = (lo + hi) / 2
  const q = pointOn(seg, t)
  return { t, d: Math.hypot(q.x - x, q.y - y) }
}

/** The contours and points a selection touches, as explicit contours. */
function bySelection(contours: Contour[], selection: Selection): Map<number, Set<number>> {
  const out = new Map<number, Set<number>>()
  for (const k of selection) {
    const { c, p } = parseKey(k)
    if (contours[c]?.[p]) out.set(c, (out.get(c) ?? new Set()).add(p))
  }
  return out
}

/**
 * Turn the straight segment after each selected on-curve point into a curve. The new control point starts halfway
 * along the line, so the shape does not change until the control point is moved; it is selected, ready to drag.
 */
export function curveSegments(contours: Contour[], selection: Selection): OutlineResult {
  const next = [...contours]
  const chosen: string[] = []
  for (const [c, points] of bySelection(contours, selection)) {
    const { contour: ex, map } = explicitContour(contours[c]!)
    const spans = spansOf(ex)
    const add = new Map<number, Point>() // index to insert after -> the control point
    for (const p of points) {
      const span = spanFor(ex, spans, map[p]!)
      if (!span || span.ctrl !== null || !ex[map[p]!]!.onCurve) continue
      const m = midpoint(ex[span.start]!, ex[span.end]!, false)
      if (samePlace(m, ex[span.start]!) || samePlace(m, ex[span.end]!)) continue
      add.set(span.start, m)
    }
    if (add.size === 0) continue
    const out: Point[] = []
    ex.forEach((pt, i) => {
      out.push(pt)
      const m = add.get(i)
      if (m) {
        chosen.push(pointKey(c, out.length))
        out.push(m)
      }
    })
    next[c] = out
  }
  if (chosen.length === 0) return { ok: false, reason: 'Select a point that starts a straight segment to turn it into a curve.' }
  return { ok: true, contours: next, selection: new Set(chosen) }
}

/** Turn the curve after each selected on-curve point, or around each selected control point, back into a straight line. */
export function straightenSegments(contours: Contour[], selection: Selection): OutlineResult {
  const next = [...contours]
  const chosen: string[] = []
  for (const [c, points] of bySelection(contours, selection)) {
    const { contour: ex, map } = explicitContour(contours[c]!)
    const spans = spansOf(ex)
    const drop = new Set<number>()
    for (const p of points) {
      const span = spanFor(ex, spans, map[p]!)
      if (span && span.ctrl !== null) drop.add(span.ctrl)
    }
    if (drop.size === 0) continue
    if (ex.length - drop.size < 3) return { ok: false, reason: 'A contour needs at least three points, so this curve cannot be straightened.' }
    const out: Point[] = []
    ex.forEach((pt, i) => {
      if (drop.has(i)) return
      out.push(pt)
      if (spans.some((s) => s.start === i && s.ctrl !== null && drop.has(s.ctrl))) chosen.push(pointKey(c, out.length - 1))
    })
    next[c] = out
  }
  if (chosen.length === 0) return { ok: false, reason: 'Select a curve, one of its points or its control point, to straighten it.' }
  return { ok: true, contours: next, selection: new Set(chosen) }
}

/**
 * Make each selected on-curve point smooth: the control points on either side of it are turned to lie on one
 * straight line through the point (keeping each one's length), so the curve passes through it without a kink.
 */
export function smoothPoints(contours: Contour[], selection: Selection): OutlineResult {
  const next = [...contours]
  let changed = 0
  const keep: string[] = []
  for (const [c, points] of bySelection(contours, selection)) {
    const { contour: ex, map } = explicitContour(contours[c]!)
    const out = [...ex]
    const n = ex.length
    for (const p of points) {
      const i = map[p]!
      const pt = ex[i]!
      const before = ex[(i - 1 + n) % n]!
      const after = ex[(i + 1) % n]!
      if (!pt.onCurve || before.onCurve || after.onCurve) continue
      const lenBefore = Math.hypot(before.x - pt.x, before.y - pt.y)
      const lenAfter = Math.hypot(after.x - pt.x, after.y - pt.y)
      // The shared direction is the average of the two handles' directions, pointing from the first handle through the point.
      const dx = (pt.x - before.x) / (lenBefore || 1) + (after.x - pt.x) / (lenAfter || 1)
      const dy = (pt.y - before.y) / (lenBefore || 1) + (after.y - pt.y) / (lenAfter || 1)
      const len = Math.hypot(dx, dy)
      if (len < 1e-9 || lenBefore === 0 || lenAfter === 0) continue
      const ux = dx / len
      const uy = dy / len
      const b: Point = { ...before, x: clampX(pt.x - ux * lenBefore), y: clampY(pt.y - uy * lenBefore) }
      const a: Point = { ...after, x: clampX(pt.x + ux * lenAfter), y: clampY(pt.y + uy * lenAfter) }
      if (b.x === before.x && b.y === before.y && a.x === after.x && a.y === after.y) continue
      out[(i - 1 + n) % n] = b
      out[(i + 1) % n] = a
      changed += 1
    }
    next[c] = out
    for (const p of points) keep.push(pointKey(c, map[p]!))
  }
  if (changed === 0) return { ok: false, reason: 'Smoothing needs an on-curve point with a curve on both sides that is not already smooth.' }
  return { ok: true, contours: next, selection: new Set(keep) }
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
  /** Index of the point the segment starts at (its on-curve start, or the control point after an implied one). */
  p: number
  distance: number
}

/** Closest line or curve to a position, within `maxDistance` font units. */
export function nearestSegment(contours: Contour[], x: number, y: number, maxDistance: number): SegmentHit | null {
  let best: SegmentHit | null = null
  contours.forEach((contour, c) => {
    for (const seg of contourSegments(contour)) {
      let d: number
      if (!seg.c) {
        const q = projectOnSegment(seg.a as Point, seg.b as Point, x, y)
        d = Math.hypot(q.x - x, q.y - y)
      } else {
        d = Infinity
        let prev = seg.a
        const N = 24
        for (let k = 1; k <= N; k++) {
          const cur = pointOn(seg, k / N)
          const q = projectOnSegment(prev as Point, cur as Point, x, y)
          d = Math.min(d, Math.hypot(q.x - x, q.y - y))
          prev = cur
        }
      }
      if (d <= maxDistance && (!best || d < best.distance)) best = { c, p: seg.from, distance: d }
    }
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

/** Where the ink reaches on the right and left, 0 for an empty outline. Curves are measured at their turning points. */
export const maxX = (contours: Contour[]) => contoursBounds(contours)?.maxX ?? 0
export const minX = (contours: Contour[]) => contoursBounds(contours)?.minX ?? 0
