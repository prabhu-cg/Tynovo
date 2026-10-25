import { computeScale, sizeForStep } from './scale'

describe('computeScale', () => {
  it('builds a modular scale around the base size', () => {
    const s = computeScale({ baseSizePx: 16, ratio: 1.25, stepsDown: 2, stepsUp: 3 })
    expect(s.map((x) => x.step)).toEqual([-2, -1, 0, 1, 2, 3])
    expect(s.map((x) => x.sizePx)).toEqual([10.24, 12.8, 16, 20, 25, 31.25])
  })
  it('collapses to a single step', () => {
    expect(computeScale({ baseSizePx: 18, ratio: 1.5, stepsDown: 0, stepsUp: 0 })).toEqual([{ step: 0, sizePx: 18 }])
  })
  it('agrees with sizeForStep and ratio 1 is flat', () => {
    const scale = { baseSizePx: 16, ratio: 1, stepsDown: 1, stepsUp: 1 }
    expect(computeScale(scale).every((x) => x.sizePx === 16)).toBe(true)
    expect(sizeForStep({ ...scale, ratio: 1.2 }, 2)).toBe(23.04)
  })
})
