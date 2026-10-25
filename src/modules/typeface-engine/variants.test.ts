// @vitest-environment node
import { dnaSchema } from '../brand-projects/schema'
import { defaultDna, DNA_CONTROLS } from './dna'
import { analyzeTypeface } from '../font-validation/coverage'
import { deriveVariant, describeDifference, exploreVariants, isReproducible } from './variants'

const base = defaultDna('rounded')

describe('seeded variation', () => {
  it('the same design, seed and spread always give the same variants', () => {
    const a = exploreVariants(base, 42, 6, 0.4)
    const b = exploreVariants(structuredClone(base), 42, 6, 0.4)
    expect(b).toEqual(a)
  })

  it('different seeds and different indices give different variants', () => {
    const a = exploreVariants(base, 1, 6, 0.4)
    expect(new Set(a.map((v) => JSON.stringify(v.dna))).size).toBe(6)
    expect(exploreVariants(base, 2, 6, 0.4)).not.toEqual(a)
  })

  it('records exactly what produced each variant', () => {
    const [v] = exploreVariants(base, 99, 3, 0.25)
    expect(v!.origin).toEqual({ seed: 99, index: 0, spread: 0.25 })
    expect(deriveVariant(base, v!.origin)).toEqual(v!.dna)
    expect(isReproducible(base, { id: 'x', name: 'x', dna: v!.dna, favourite: false, origin: v!.origin, createdAt: '2026-01-01T00:00:00.000Z' })).toBe(true)
    expect(isReproducible(defaultDna('modular'), { id: 'x', name: 'x', dna: v!.dna, favourite: false, origin: v!.origin, createdAt: '2026-01-01T00:00:00.000Z' })).toBe(false)
  })

  it('zero spread changes nothing; larger spread moves further', () => {
    expect(deriveVariant(base, { seed: 3, index: 0, spread: 0 })).toEqual(base)
    const dist = (spread: number) => exploreVariants(base, 7, 20, spread).reduce((sum, v) => sum + describeDifference(base, v.dna).length, 0)
    expect(dist(0.8)).toBeGreaterThan(dist(0.1))
  })

  it('variants always satisfy the schema, stay inside control ranges and keep family, grid and vertical metrics', () => {
    for (const spread of [0.1, 0.5, 0.8]) {
      for (const v of exploreVariants(base, 11, 40, spread)) {
        expect(dnaSchema.safeParse(v.dna).success).toBe(true)
        for (const c of DNA_CONTROLS) {
          expect(v.dna[c.key]).toBeGreaterThanOrEqual(c.min)
          expect(v.dna[c.key]).toBeLessThanOrEqual(c.max)
        }
        expect(v.dna).toMatchObject({ family: base.family, grid: base.grid, capHeight: base.capHeight, ascenderRise: base.ascenderRise, descenderDepth: base.descenderDepth, overshoot: base.overshoot })
      }
    }
  })

  it('every explored variant generates valid glyphs', { timeout: 60_000 }, () => {
    for (const family of ['geometric', 'rounded', 'modular'] as const) {
      for (const v of exploreVariants(defaultDna(family), 5, 8, 0.8)) {
        const bad = [...analyzeTypeface({ dna: v.dna, overrides: {} }).reports.values()].filter((r) => r.status === 'invalid' || (r.status === 'missing' && r.reason !== 'no-recipe'))
        expect(bad.map((r) => r.char), `${family} #${v.origin.index}`).toEqual([])
      }
    }
  })

  it('describeDifference lists changed parameters', () => {
    expect(describeDifference(base, base)).toEqual([])
    expect(describeDifference(base, { ...base, strokeThickness: 140, terminal: 'flat' })).toEqual(['Stroke thickness 100 → 140', 'Terminals round → flat'])
  })
})
