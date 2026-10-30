import type { Contour } from '@/modules/brand-projects/schema'
import { contourSegments, contourToSvgPath, contoursBounds, controlBounds, flattenContour, isClockwise, pointOn, reverseContour, signedArea } from './geometry'

const sq: Contour = [
  { x: 0, y: 0, onCurve: true },
  { x: 0, y: 10, onCurve: true },
  { x: 10, y: 10, onCurve: true },
  { x: 10, y: 0, onCurve: true },
]

describe('geometry', () => {
  it('computes winding in a y-up system', () => {
    expect(signedArea(sq)).toBe(-100)
    expect(isClockwise(sq)).toBe(true)
    expect(isClockwise(reverseContour(sq))).toBe(false)
  })
  it('computes bounds', () => {
    expect(contoursBounds([sq])).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 })
    expect(contoursBounds([])).toBeNull()
  })
  it('converts straight contours to SVG', () => {
    expect(contourToSvgPath(sq)).toBe('M0 0L0 10L10 10L10 0Z')
  })
  it('converts quadratic contours, including implied on-curve points', () => {
    const c: Contour = [
      { x: 0, y: 0, onCurve: true },
      { x: 5, y: 10, onCurve: false },
      { x: 10, y: 0, onCurve: true },
    ]
    expect(contourToSvgPath(c)).toBe('M0 0Q5 10 10 0Z')
    const allOff: Contour = [
      { x: 0, y: 0, onCurve: false },
      { x: 10, y: 0, onCurve: false },
      { x: 10, y: 10, onCurve: false },
    ]
    expect(contourToSvgPath(allOff).startsWith('M5 0Q10 0 10 5')).toBe(true)
  })

})

/** A circle of radius 100 centred on the origin, as TrueType draws it: eight points, four on the curve and four controls at the corners of the square. Clockwise. */
const circle: Contour = [
  { x: -100, y: 0, onCurve: true }, { x: -100, y: 100, onCurve: false }, { x: 0, y: 100, onCurve: true }, { x: 100, y: 100, onCurve: false },
  { x: 100, y: 0, onCurve: true }, { x: 100, y: -100, onCurve: false }, { x: 0, y: -100, onCurve: true }, { x: -100, y: -100, onCurve: false },
]

describe('curves', () => {
  it('splits a contour into lines and quadratic pieces, and closes it', () => {
    const segs = contourSegments(circle)
    expect(segs).toHaveLength(4)
    expect(segs.every((s) => s.c !== undefined)).toBe(true)
    expect(segs[0]).toMatchObject({ a: { x: -100, y: 0 }, c: { x: -100, y: 100 }, b: { x: 0, y: 100 }, from: 0 })
    expect(segs[3]!.b).toMatchObject({ x: -100, y: 0 }) // the last piece comes back to the start
    expect(contourSegments(sq)).toHaveLength(4)
    expect(contourSegments(sq).every((s) => s.c === undefined)).toBe(true)
  })

  it('treats two off-curve points in a row as having an on-curve point halfway between them', () => {
    const c: Contour = [{ x: 0, y: 0, onCurve: true }, { x: 10, y: 20, onCurve: false }, { x: 30, y: 20, onCurve: false }, { x: 40, y: 0, onCurve: true }]
    const segs = contourSegments(c)
    expect(segs[0]!.b).toEqual({ x: 20, y: 20 })
    expect(segs[1]).toMatchObject({ a: { x: 20, y: 20 }, c: { x: 30, y: 20 }, b: { x: 40, y: 0 } })
  })

  it('measures the ink where it really reaches, not at the control points', () => {
    const b = contoursBounds([circle])!
    // A quadratic reaches three quarters of the way to its control point, so the ink stays inside the control box.
    expect(b).toEqual({ minX: -100, minY: -100, maxX: 100, maxY: 100 })
    const bump: Contour = [{ x: 0, y: 0, onCurve: true }, { x: 50, y: 400, onCurve: false }, { x: 100, y: 0, onCurve: true }, { x: 100, y: -20, onCurve: true }, { x: 0, y: -20, onCurve: true }]
    expect(contoursBounds([bump])).toEqual({ minX: 0, minY: -20, maxX: 100, maxY: 200 })
    expect(controlBounds([bump])).toEqual({ minX: 0, minY: -20, maxX: 100, maxY: 400 })
  })

  it('computes the area of a curved contour along its curve', () => {
    // Four quadratic arcs with controls at the corners of the square bulge past a circle but stay inside the square: 10/3 r squared.
    const a = Math.abs(signedArea(circle))
    expect(a).toBeGreaterThan(Math.PI * 100 * 100)
    expect(a).toBeLessThan(4 * 100 * 100)
    expect(a).toBeCloseTo((10 / 3) * 100 * 100, -2)
    expect(isClockwise(circle)).toBe(true)
    expect(isClockwise(reverseContour(circle))).toBe(false)
  })

  it('flattens to a polygon with a fixed number of pieces, and a straight contour to itself', () => {
    expect(flattenContour(sq)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 }])
    expect(flattenContour(circle, 8)).toHaveLength(4 * 8)
    const p = pointOn(contourSegments(circle)[0]!, 0.5)
    expect(p.x).toBeCloseTo(-75, 5)
    expect(p.y).toBeCloseTo(75, 5)
  })
})
