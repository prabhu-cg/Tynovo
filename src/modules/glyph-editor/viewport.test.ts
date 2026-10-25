import { fitView, MAX_UPP, MIN_UPP, panBy, toScreen, toWorld, viewBox, zoomAt, zoomPercent, type Size, type View } from './viewport'

const size: Size = { w: 800, h: 600 }
const view: View = { cx: 300, cy: 400, upp: 2 }

describe('viewport', () => {
  it('converts between screen and world and back', () => {
    const w = toWorld(view, size, 123, 456)
    const s = toScreen(view, size, w.x, w.y)
    expect(s.px).toBeCloseTo(123)
    expect(s.py).toBeCloseTo(456)
    expect(toWorld(view, size, 400, 300)).toEqual({ x: 300, y: 400 }) // the centre of the canvas is the view centre
  })
  it('y runs up: a point lower on the screen has a smaller y', () => {
    expect(toWorld(view, size, 400, 400).y).toBeLessThan(toWorld(view, size, 400, 200).y)
  })
  it('fit shows the whole box with padding, centred', () => {
    const v = fitView(size, { minX: 0, maxX: 600, minY: -200, maxY: 800 }, 40)
    expect(v.cx).toBe(300)
    expect(v.cy).toBe(300)
    const topLeft = toScreen(v, size, 0, 800)
    const bottomRight = toScreen(v, size, 600, -200)
    expect(topLeft.py).toBeGreaterThanOrEqual(39.9)
    expect(bottomRight.py).toBeLessThanOrEqual(size.h - 39.9)
    expect(topLeft.px).toBeGreaterThanOrEqual(0)
  })
  it('zooming keeps the point under the cursor still', () => {
    const before = toWorld(view, size, 600, 150)
    const z = zoomAt(view, size, 2, 600, 150)
    expect(z.upp).toBe(1)
    const after = toWorld(z, size, 600, 150)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })
  it('limits zoom in both directions', () => {
    expect(zoomAt(view, size, 1e6, 0, 0).upp).toBe(MIN_UPP)
    expect(zoomAt(view, size, 1e-6, 0, 0).upp).toBe(MAX_UPP)
  })
  it('panning by drag moves the content with the pointer', () => {
    const p = panBy(view, 50, -20)
    const anchorBefore = toScreen(view, size, 100, 100)
    const anchorAfter = toScreen(p, size, 100, 100)
    expect(anchorAfter.px - anchorBefore.px).toBeCloseTo(50)
    expect(anchorAfter.py - anchorBefore.py).toBeCloseTo(-20)
  })
  it('builds a viewBox for a y-flipped drawing and reports zoom as units per pixel', () => {
    expect(viewBox({ cx: 0, cy: 0, upp: 1 }, { w: 100, h: 50 })).toBe('-50 -25 100 50')
    expect(zoomPercent({ cx: 0, cy: 0, upp: 2 })).toBe(50)
  })
})
