import { inkAgreement } from './renderingCheck'

/** A width x height RGBA bitmap with ink at the listed (x, y) pixels. */
const bitmap = (w: number, h: number, ink: Array<[number, number]>) => {
  const d = new Uint8ClampedArray(w * h * 4)
  for (const [x, y] of ink) d[(y * w + x) * 4 + 3] = 255
  return d
}
const block = (x0: number, y0: number, x1: number, y1: number): Array<[number, number]> => {
  const out: Array<[number, number]> = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y])
  return out
}

describe('inkAgreement', () => {
  it('is 1 for identical ink and for two blank canvases', () => {
    const a = bitmap(20, 20, block(5, 5, 12, 12))
    expect(inkAgreement(a, a, 20, 20)).toBe(1)
    expect(inkAgreement(bitmap(8, 8, []), bitmap(8, 8, []), 8, 8)).toBe(1)
  })
  it('ignores a one-pixel shift of an edge (anti-aliasing, pixel snapping)', () => {
    expect(inkAgreement(bitmap(30, 30, block(5, 5, 20, 20)), bitmap(30, 30, block(6, 5, 21, 20)), 30, 30)).toBe(1)
  })
  it('does not ignore a shape that has moved several pixels', () => {
    const r = inkAgreement(bitmap(40, 30, block(5, 5, 14, 14)), bitmap(40, 30, block(11, 5, 20, 14)), 40, 30)
    expect(r).toBeLessThan(0.5)
  })
  it('is 0 when one rendering is blank and the other is not', () => {
    expect(inkAgreement(bitmap(10, 10, block(2, 2, 6, 6)), bitmap(10, 10, []), 10, 10)).toBe(0)
  })
  it('ignores faint anti-aliasing below the ink threshold', () => {
    const faint = new Uint8ClampedArray(10 * 10 * 4)
    faint[3] = 60
    expect(inkAgreement(faint, bitmap(10, 10, []), 10, 10)).toBe(1)
  })
})
