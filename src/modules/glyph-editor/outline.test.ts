import type { Contour } from '@/modules/brand-projects/schema'
import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { createTypeface } from '@/modules/typeface-engine/typeface'
import {
  allKeys, contourKeys, deletePoints, fixWinding, insertPointAfter, insertPointAt, movePoints, nearestPoint, nearestSegment,
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
