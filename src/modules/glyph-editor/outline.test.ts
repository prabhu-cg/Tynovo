import type { Contour } from '@/modules/brand-projects/schema'
import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { createTypeface } from '@/modules/typeface-engine/typeface'
import { contourSegments, contoursBounds, flattenContour, pointOn } from './geometry'
import {
  allKeys, contourKeys, curveSegments, deletePoints, explicitContour, fixWinding, insertPointAfter, insertPointAt, movePoints, nearestPoint, nearestSegment, smoothPoints, straightenSegments,
  pointKey, pointsInRect, removeDuplicatePoints, sameContours, setPoint, stepContour, stepPoint, validSelection, X_LIMIT,
} from './outline'

const pt = (x: number, y: number) => ({ x, y, onCurve: true })
const square = (x: number, y: number, s: number, cw = true): Contour => {
  const pts = [pt(x, y), pt(x, y + s), pt(x + s, y + s), pt(x + s, y)] // clockwise in y-up
  return cw ? pts : [...pts].reverse()
}

describe('movePoints / setPoint', () => {
  it('moves only the selected points, in whole units, and leaves the input untouched', () => {
    const input = [square(0, 0, 100), square(300, 0, 100)]
    const before = JSON.stringify(input)
    const out = movePoints(input, new Set([pointKey(0, 1)]), 5, -3)
    expect(out[0]![1]).toEqual({ x: 5, y: 97, onCurve: true })
    expect(out[0]![0]).toEqual(input[0]![0])
    expect(out[1]).toBe(input[1]) // untouched contours keep identity
    expect(JSON.stringify(input)).toBe(before)
  })
  it('clamps instead of producing coordinates no tool could open', () => {
    const out = movePoints([square(0, 0, 100)], new Set([pointKey(0, 2)]), 99999, 0)
    expect(out[0]![2]!.x).toBe(X_LIMIT.max)
  })
  it('is a no-op for an empty selection or a zero move', () => {
    const c = [square(0, 0, 100)]
    expect(movePoints(c, new Set(), 4, 4)).toBe(c)
    expect(movePoints(c, allKeys(c), 0, 0)).toBe(c)
  })
  it('setPoint rounds typed values and returns the same array when nothing changes', () => {
    const c = [square(0, 0, 100)]
    expect(setPoint(c, 0, 0, 0, 0)).toBe(c)
    expect(setPoint(c, 0, 0, 10.4, 20.6)[0]![0]).toMatchObject({ x: 10, y: 21 })
    expect(setPoint(c, 5, 0, 1, 1)).toBe(c)
  })
})

describe('insert and delete', () => {
  it('inserts a point halfway along a segment and selects it', () => {
    const r = insertPointAfter([square(0, 0, 100)], 0, 0)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.contours[0]).toHaveLength(5)
    expect(r.contours[0]![1]).toEqual({ x: 0, y: 50, onCurve: true })
    expect([...r.selection]).toEqual([pointKey(0, 1)])
  })
  it('wraps around: the last point splits the closing segment', () => {
    const r = insertPointAfter([square(0, 0, 100)], 0, 3)
    expect(r.ok && r.contours[0]![4]).toEqual({ x: 50, y: 0, onCurve: true })
  })
  it('refuses to split a segment that is too short for whole units', () => {
    const tiny: Contour = [pt(0, 0), pt(0, 1), pt(50, 50)]
    const r = insertPointAfter([tiny], 0, 0)
    expect(r.ok).toBe(false)
  })
  it('inserts at a clicked position projected onto the segment', () => {
    const r = insertPointAt([square(0, 0, 100)], 0, 1, 30, 140) // top edge runs (0,100) to (100,100)
    expect(r.ok && r.contours[0]![2]).toEqual({ x: 30, y: 100, onCurve: true })
  })
  it('deletes points but keeps at least three per contour', () => {
    const c = [square(0, 0, 100)]
    const one = deletePoints([[...c[0]!, pt(50, -10)]], new Set([pointKey(0, 4)]))
    expect(one.ok && one.contours[0]).toHaveLength(4)
    const tooMany = deletePoints(c, new Set([pointKey(0, 0), pointKey(0, 1)]))
    expect(tooMany.ok).toBe(false)
  })
  it('removes a whole contour when all of its points are selected', () => {
    const c = [square(0, 0, 100), square(300, 0, 100)]
    const r = deletePoints(c, contourKeys(c, 1))
    expect(r.ok && r.contours).toHaveLength(1)
  })
  it('says what to do with an empty selection', () => {
    const r = deletePoints([square(0, 0, 10)], new Set())
    expect(!r.ok && r.reason).toMatch(/select a point/i)
  })
})

describe('picking and stepping', () => {
  const c = [square(0, 0, 100), square(300, 0, 100)]
  it('finds the nearest point and segment within a radius', () => {
    expect(nearestPoint(c, 3, 4, 10)).toMatchObject({ c: 0, p: 0 })
    expect(nearestPoint(c, 150, 50, 10)).toBeNull()
    expect(nearestSegment(c, 50, 4, 10)).toMatchObject({ c: 0, p: 3 })
  })
  it('selects points inside a rectangle regardless of drag direction', () => {
    expect([...pointsInRect(c, 120, 120, -10, -10)].sort()).toEqual(['0:0', '0:1', '0:2', '0:3'])
  })
  it('steps through points and contours with wrap-around', () => {
    expect(stepPoint(c, null, 1)).toEqual({ c: 0, p: 0 })
    expect(stepPoint(c, { c: 0, p: 3 }, 1)).toEqual({ c: 1, p: 0 })
    expect(stepPoint(c, { c: 0, p: 0 }, -1)).toEqual({ c: 1, p: 3 })
    expect(stepContour(c, 1, 1)).toBe(0)
    expect(stepContour([], null, 1)).toBeNull()
  })
  it('drops selection keys that no longer exist', () => {
    const s = new Set(['0:1', '1:9', '4:0'])
    expect([...validSelection(c, s)]).toEqual(['0:1'])
  })
})

describe('repairs', () => {
  it('removes stacked points, including across the wrap-around', () => {
    const dup: Contour = [pt(0, 0), pt(0, 0), pt(0, 100), pt(100, 100), pt(100, 0), pt(0, 0)]
    const { contours, removed } = removeDuplicatePoints([dup])
    expect(removed).toBe(2)
    expect(contours[0]).toHaveLength(4)
  })
  it('fixWinding reverses only contours that run the wrong way (outer clockwise, counter counter-clockwise)', () => {
    const wrongOuter = square(0, 0, 300, false)
    const goodCounter = square(100, 100, 100, false)
    const r = fixWinding([wrongOuter, goodCounter])
    expect(r.reversed).toBe(1)
    expect(r.contours[1]).toBe(goodCounter)
    expect(sameContours(r.contours, [square(0, 0, 300, true), goodCounter])).toBe(true)
  })
})

describe('on real generated glyphs', () => {
  it('moving a point of a generated glyph keeps it a valid, whole-unit outline unless it crosses itself', () => {
    const a = analyzeTypeface(createTypeface('f', 'geometric')).reports.get('H')!.glyph!
    const moved = movePoints(a.contours, new Set([pointKey(0, 0)]), 3, 0)
    expect(moved.flat().every((p) => Number.isInteger(p.x) && Number.isInteger(p.y))).toBe(true)
    expect(sameContours(moved, a.contours)).toBe(false)
  })
})

const off = (x: number, y: number) => ({ x, y, onCurve: false })

/** A closed shape: a flat bottom and a curved top (one control point), clockwise in y-up. */
const dome = (): Contour => [pt(0, 0), pt(0, 100), off(200, 300), pt(400, 100), pt(400, 0)]

/** The maximum distance between two curves, sampled along both. */
function drift(a: Contour, b: Contour): number {
  const A = flattenContour(a, 64)
  const B = flattenContour(b, 64)
  const dist = (p: { x: number; y: number }, poly: { x: number; y: number }[]) => {
    let d = Infinity
    poly.forEach((q, i) => {
      const r = poly[(i + 1) % poly.length]!
      const dx = r.x - q.x
      const dy = r.y - q.y
      const t = Math.max(0, Math.min(1, ((p.x - q.x) * dx + (p.y - q.y) * dy) / (dx * dx + dy * dy || 1)))
      d = Math.min(d, Math.hypot(q.x + t * dx - p.x, q.y + t * dy - p.y))
    })
    return d
  }
  return Math.max(...A.map((p) => dist(p, B)), ...B.map((p) => dist(p, A)))
}

describe('curves: making and removing them', () => {
  it('turns the straight segment after a point into a curve without changing the shape, and selects the new control point', () => {
    const r = curveSegments([square(0, 0, 100)], new Set([pointKey(0, 1)]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.contours[0]).toHaveLength(5)
    expect(r.contours[0]![2]).toEqual({ x: 50, y: 100, onCurve: false }) // halfway along the top edge
    expect([...r.selection]).toEqual([pointKey(0, 2)])
    expect(drift(r.contours[0]!, square(0, 0, 100))).toBeLessThan(0.001) // a control point on the line draws the line
  })

  it('curves several segments at once, one control point each', () => {
    const r = curveSegments([square(0, 0, 100)], new Set([pointKey(0, 0), pointKey(0, 2)]))
    expect(r.ok && r.contours[0]!.filter((p) => !p.onCurve)).toHaveLength(2)
  })

  it('does nothing, and says why, for a segment that is already a curve or a selection with no segment', () => {
    const r = curveSegments([dome()], new Set([pointKey(0, 1)]))
    expect(r).toMatchObject({ ok: false })
    expect(curveSegments([square(0, 0, 100)], new Set())).toMatchObject({ ok: false })
  })

  it('straightens a curve from its start point, from its control point, or from the point before it', () => {
    for (const k of [pointKey(0, 1), pointKey(0, 2)]) {
      const r = straightenSegments([dome()], new Set([k]))
      expect(r.ok).toBe(true)
      if (!r.ok) continue
      expect(r.contours[0]!.every((p) => p.onCurve)).toBe(true)
      expect(r.contours[0]).toHaveLength(4)
    }
    expect(straightenSegments([square(0, 0, 100)], new Set([pointKey(0, 1)]))).toMatchObject({ ok: false })
  })

  it('will not straighten a curve if that would leave fewer than three points', () => {
    const lens: Contour = [pt(0, 0), off(50, 100), pt(100, 0), off(50, -100)]
    expect(straightenSegments([lens], new Set([pointKey(0, 0), pointKey(0, 2)]))).toMatchObject({ ok: false })
  })
})

describe('curves: splitting', () => {
  it('splits a curve at its middle into two curves with the same shape, one new on-curve point on the curve', () => {
    const before = dome()
    const r = insertPointAfter([before], 0, 1)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const after = r.contours[0]!
    expect(after).toHaveLength(7) // the control point became two controls and a point between them
    expect(after.filter((p) => !p.onCurve)).toHaveLength(2)
    const key = [...r.selection][0]!
    const m = after[Number(key.split(':')[1])]!
    expect(m.onCurve).toBe(true)
    expect(m).toMatchObject({ x: 200, y: 200 }) // on the curve: halfway between 100 and the control height 300
    expect(drift(after, before)).toBeLessThan(1) // rounding to whole units only
  })

  it('splits a curve where the pointer is, and the halves still follow the original', () => {
    const before = dome()
    const seg = contourSegments(before)[1]! // the curve
    const on = pointOn(seg, 0.2)
    const r = insertPointAt([before], 0, 0, on.x + 3, on.y + 3)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const m = r.contours[0]![Number([...r.selection][0]!.split(':')[1])]!
    expect(Math.hypot(m.x - on.x, m.y - on.y)).toBeLessThan(6) // near the pointer’s projection
    expect(drift(r.contours[0]!, before)).toBeLessThan(1)
  })

  it('splits a straight segment as before', () => {
    const r = insertPointAfter([square(0, 0, 100)], 0, 0)
    expect(r.ok && r.contours[0]![1]).toMatchObject({ x: 0, y: 50, onCurve: true })
  })

  it('splitting from a control point splits the curve it shapes', () => {
    const r = insertPointAfter([dome()], 0, 2)
    expect(r.ok && r.contours[0]).toHaveLength(7)
  })

  it('writes out the point implied between two controls, so a chain of curves can be edited', () => {
    const chain: Contour = [pt(0, 0), off(0, 100), off(200, 100), pt(200, 0)]
    const { contour, map } = explicitContour(chain)
    expect(contour).toHaveLength(5)
    expect(contour[2]).toEqual({ x: 100, y: 100, onCurve: true })
    expect(map).toEqual([0, 1, 3, 4])
    expect(drift(contour, chain)).toBeLessThan(0.001)
    const r = insertPointAt([chain], 0, 0, 150, 90)
    expect(r.ok).toBe(true)
  })
})

describe('curves: smoothing, picking, bounds', () => {
  it('lines up the two control points of a point so the curve has no kink there', () => {
    // A point at (100, 100) with a control point up-left and another to the right and down: a kink.
    const c: Contour = [pt(0, 0), off(0, 100), pt(100, 100), off(200, 80), pt(200, 0)]
    const r = smoothPoints([c], new Set([pointKey(0, 2)]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [b, p, a] = [r.contours[0]![1]!, r.contours[0]![2]!, r.contours[0]![3]!]
    const cross = (p.x - b.x) * (a.y - p.y) - (p.y - b.y) * (a.x - p.x)
    expect(Math.abs(cross)).toBeLessThan(120) // collinear up to rounding of whole units
    expect(Math.hypot(b.x - p.x, b.y - p.y)).toBeCloseTo(100, 0) // handle lengths are kept
    expect(Math.hypot(a.x - p.x, a.y - p.y)).toBeCloseTo(Math.hypot(100, 20), 0)
    expect(p).toMatchObject({ x: 100, y: 100 }) // the point itself does not move
  })

  it('refuses to smooth a point that is not between two curves', () => {
    expect(smoothPoints([dome()], new Set([pointKey(0, 0)]))).toMatchObject({ ok: false })
    expect(smoothPoints([dome()], new Set([pointKey(0, 2)]))).toMatchObject({ ok: false }) // a control point, not a point
  })

  it('finds a curve under the pointer, not just the straight line between its points', () => {
    const d = dome()
    const seg = contourSegments(d)[1]!
    const on = pointOn(seg, 0.5)
    expect(nearestSegment([d], on.x, on.y + 2, 6)).toMatchObject({ c: 0, p: 1 })
    expect(nearestSegment([d], 200, 100, 6)).toBeNull() // the chord's midpoint is far from the curve (100 below it)
  })

  it('measures where the outline reaches along curves, so spacing follows the ink', () => {
    expect(contoursBounds([dome()])).toEqual({ minX: 0, minY: 0, maxX: 400, maxY: 200 })
  })
})
