import type { Contour } from '@/modules/brand-projects/schema'
import { contourToSvgPath, contoursBounds, isClockwise, reverseContour, signedArea } from './geometry'

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
