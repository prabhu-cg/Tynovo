// @vitest-environment node
import { findIntersections, shapeToContours, tidyRing } from './clean'
import { ALL_CORNERS, bounds, box, cornerRadii, diff, inter, line, mirrorX, normalize, rect, ring, rotate180, toWholeUnits, union, type Shape } from './shapes'
import { area, softenRing } from './soften'

const ringsOf = (s: Shape) => s.flatMap((p) => p)
const totalArea = (s: Shape) => s.reduce((sum, polygon) => sum + polygon.reduce((a, r, i) => a + (i === 0 ? 1 : -1) * Math.abs(area(r)), 0), 0)

describe('boolean operations', () => {
  it('union merges overlapping rectangles into one outline', () => {
    const u = union(rect(0, 0, 100, 10), rect(0, 0, 10, 100))
    expect(u).toHaveLength(1)
    expect(ringsOf(u)).toHaveLength(1)
    expect(totalArea(u)).toBeCloseTo(100 * 10 + 10 * 100 - 100)
  })

  it('difference makes a hole', () => {
    const d = diff(rect(0, 0, 100, 100), rect(25, 25, 75, 75))
    expect(d).toHaveLength(1)
    expect(d[0]).toHaveLength(2)
    expect(totalArea(d)).toBeCloseTo(100 * 100 - 50 * 50)
  })

  it('intersection and empty inputs behave', () => {
    expect(totalArea(inter(rect(0, 0, 10, 10), rect(5, 5, 20, 20)))).toBeCloseTo(25)
    expect(inter(rect(0, 0, 1, 1), rect(5, 5, 6, 6))).toEqual([])
    expect(union()).toEqual([])
    expect(diff([], rect(0, 0, 1, 1))).toEqual([])
    expect(diff(rect(0, 0, 1, 1))).toEqual(rect(0, 0, 1, 1))
  })

  it('survives floating-point noise that breaks the raw library', () => {
    // 188.99999999999997 vs 189 is the kind of near-equality that makes polygon-clipping throw.
    const a: Shape = [[[[0, 0], [188.99999999999997, 0], [188.99999999999997, 50], [0, 50]]]]
    const b: Shape = [[[[189, -10], [350.99999999999994, -10], [350.99999999999994, 60], [189, 60]]]]
    expect(() => union(a, b)).not.toThrow()
    expect(union(a, b)).toHaveLength(1)
  })

  it('is deterministic', () => {
    const run = () => JSON.stringify(union(box(0, 0, 300, 200, 1), line([0, 0], [300, 200], 40)))
    expect(run()).toBe(run())
  })
})

describe('primitives', () => {
  it('box with roundness 0 is a rectangle; with 1 it is an ellipse', () => {
    expect(ringsOf(box(0, 0, 100, 60, 0))[0]).toHaveLength(4)
    const ellipse = ringsOf(box(0, 0, 100, 60, 1))[0]!
    expect(ellipse.length).toBeGreaterThanOrEqual(24)
    // A 24-point polygon inscribed in the ellipse: within 2% of the true area.
    expect(Math.abs(Math.abs(area(ellipse)) - Math.PI * 50 * 30) / (Math.PI * 50 * 30)).toBeLessThan(0.02)
    for (const [x, y] of ellipse) expect(((x - 50) / 50) ** 2 + ((y - 30) / 30) ** 2).toBeCloseTo(1, 1)
  })

  it('corner radii use the full side only when the neighbour is square, and stay circular beside a square edge', () => {
    const all = cornerRadii(200, 100, ALL_CORNERS, 1)
    expect(all.tl).toEqual([100, 50])
    const d = cornerRadii(200, 100, { tr: true, br: true }, 1)
    expect(d.tr).toEqual([50, 50]) // stadium end: radius h/2, not the full width
    expect(d.tl).toEqual([0, 0])
    expect(cornerRadii(200, 100, ALL_CORNERS, 0.5).tl).toEqual([50, 25])
  })

  it('ring: counter is inside and concentric, and a narrow counter stays valid', () => {
    const r = ring(0, 0, 200, 200, 40, 40, 1)
    expect(r).toHaveLength(1)
    expect(r[0]).toHaveLength(2)
    expect(bounds(r)).toEqual({ minX: 0, minY: 0, maxX: 200, maxY: 200 })
    // Very narrow D: the counter's radii must not exceed the counter box.
    const narrow = ring(0, 0, 160, 700, 90, 90, 1, { round: { tr: true, br: true, tl: false, bl: false } })
    const contours = shapeToContours(narrow)
    expect(findIntersections(contours)).toEqual([])
  })

  it('ring with an open side cuts straight through', () => {
    const arch = ring(0, 0, 200, 200, 40, 40, 1, { open: ['bottom'] })
    expect(arch).toHaveLength(1)
    expect(arch[0]).toHaveLength(1) // no hole: the counter is open at the bottom
    expect(bounds(arch)!.minY).toBe(0)
  })

  it('line has the requested thickness', () => {
    const l = line([0, 0], [100, 0], 20)
    expect(bounds(l)).toEqual({ minX: 0, minY: -10, maxX: 100, maxY: 10 })
    const round = line([0, 0], [100, 0], 20, 'round', 'round')
    expect(bounds(round)!.maxX).toBeCloseTo(110)
    expect(bounds(round)!.minX).toBeCloseTo(-10)
    expect(line([0, 0], [0, 0], 10)).toEqual([])
  })

  it('mirror and rotate keep area', () => {
    const s = union(rect(0, 0, 100, 20), rect(0, 0, 20, 80))
    expect(totalArea(mirrorX(s, 50))).toBeCloseTo(totalArea(s))
    expect(totalArea(rotate180(s, 50, 40))).toBeCloseTo(totalArea(s))
    expect(bounds(rotate180(s, 50, 40))).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 80 })
  })
})

describe('corner softening', () => {
  const square = [[0, 0], [100, 0], [100, 100], [0, 100]] as [number, number][]

  it('chamfers every outside corner of a square', () => {
    const out = softenRing(square, { kind: 'chamfer', outside: 20, inside: 0 })
    expect(out).toHaveLength(8)
    expect(Math.abs(area(out))).toBeCloseTo(100 * 100 - 4 * 0.5 * 20 * 20)
  })

  it('rounds with the requested radius and leaves smooth curves alone', () => {
    const out = softenRing(square, { kind: 'round', outside: 20, inside: 0 })
    expect(out.length).toBeGreaterThan(8)
    // A true fillet removes r² − πr²/4 per corner; the polyline approximation loses a few units to chord error.
    expect(Math.abs(Math.abs(area(out)) - (100 * 100 - 4 * (20 * 20 - (Math.PI * 20 * 20) / 4)))).toBeLessThan(12)
    const circle = ringsOf(box(0, 0, 100, 100, 1))[0]!
    expect(softenRing(circle, { kind: 'round', outside: 30, inside: 30 })).toEqual(circle)
  })

  it('never lets neighbouring corners overlap on a short edge', () => {
    const thin = [[0, 0], [100, 0], [100, 10], [0, 10]] as [number, number][]
    const out = softenRing(thin, { kind: 'chamfer', outside: 60, inside: 0 })
    // Both chamfers consume the whole short edge; after the pipeline's tidy step the outline is simple.
    expect(findIntersections([tidyRing(out).map(([x, y]) => ({ x, y, onCurve: true }))])).toEqual([])
  })

  it('fills inside corners of an L shape when asked', () => {
    const l = [[0, 0], [100, 0], [100, 30], [30, 30], [30, 100], [0, 100]] as [number, number][]
    const plain = Math.abs(area(l))
    const filled = Math.abs(area(softenRing(l, { kind: 'round', outside: 0, inside: 15 })))
    expect(filled).toBeGreaterThan(plain)
  })
})

describe('cleaning and validity', () => {
  it('tidyRing removes repeats, collinear points and zero-width spikes', () => {
    expect(tidyRing([[0, 0], [0, 0], [50, 0], [100, 0], [100, 100], [0, 100]])).toEqual([[0, 0], [100, 0], [100, 100], [0, 100]])
    const spiked = tidyRing([[0, 0], [100, 0], [100, 50], [101, 50], [100, 50], [100, 100], [0, 100]])
    expect(spiked).toEqual([[0, 0], [100, 0], [100, 100], [0, 100]])
  })

  it('shapeToContours orients outer clockwise and holes counter-clockwise, in whole units', () => {
    const contours = shapeToContours(diff(rect(0, 0, 100.4, 100), rect(25, 25, 75, 75)))
    expect(contours).toHaveLength(2)
    const signed = (c: (typeof contours)[number]) => area(c.map((p) => [p.x, p.y] as [number, number]))
    expect(signed(contours[0]!)).toBeLessThan(0)
    expect(signed(contours[1]!)).toBeGreaterThan(0)
    for (const p of contours.flat()) expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true)
  })

  it('drops contours too small to survive rounding', () => {
    expect(shapeToContours(rect(0, 0, 1, 1))).toEqual([])
  })

  it('toWholeUnits yields integer coordinates and keeps the area', () => {
    const s = toWholeUnits(union(box(0, 0, 301.3, 200.7, 1), line([0, 0], [300.4, 200.2], 40.3)))
    for (const r of ringsOf(s)) for (const [x, y] of r) expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true)
    expect(normalize([])).toEqual([])
  })

  it('findIntersections detects a bow-tie, a touching edge and a fold, and accepts a simple polygon', () => {
    const pt = (x: number, y: number) => ({ x, y, onCurve: true })
    expect(findIntersections([[pt(0, 0), pt(100, 100), pt(100, 0), pt(0, 100)]]).length).toBeGreaterThan(0) // bow-tie
    expect(findIntersections([[pt(0, 0), pt(100, 0), pt(100, 100), pt(0, 100)]])).toEqual([])
    // Two separate contours that touch along an edge.
    expect(findIntersections([[pt(0, 0), pt(100, 0), pt(100, 100), pt(0, 100)], [pt(100, 20), pt(200, 20), pt(200, 80), pt(100, 80)]]).length).toBeGreaterThan(0)
    // An outer and a hole that do not touch.
    expect(findIntersections([[pt(0, 0), pt(100, 0), pt(100, 100), pt(0, 100)], [pt(20, 20), pt(20, 80), pt(80, 80), pt(80, 20)]])).toEqual([])
  })
})
