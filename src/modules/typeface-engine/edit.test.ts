// @vitest-environment node
import { defaultDna } from './dna'
import {
  applyVariant, checkpoint, deleteVariant, freezeGlyph, HISTORY_LIMIT, patchDna, renameVariant, resetAllOverrides, resetDna, resetGlyph, restoreSnapshot,
  saveVariant, setGlyphParams, setGlyphSpacing, switchFamily, toggleFavourite, unfreezeGlyph, VARIANT_LIMIT,
} from './edit'
import { createTypeface } from './typeface'
import { exploreVariants } from './variants'
import { customTypefaceSchema } from '../brand-projects/schema'

let n = 0
const stamp = () => ({ id: `id-${++n}`, at: `2026-01-01T00:00:${String(n % 60).padStart(2, '0')}.000Z` })
const base = createTypeface('t', 'geometric')

describe('typeface creation', () => {
  it('produces a valid, override-free typeface for each family', () => {
    for (const f of ['geometric', 'rounded', 'modular'] as const) {
      const t = createTypeface('x', f)
      expect(customTypefaceSchema.safeParse(t).success).toBe(true)
      expect(t.overrides).toEqual({})
      expect(t.dna.family).toBe(f)
    }
  })
})

describe('global edits', () => {
  it('patchDna returns the same object when nothing changes and never mutates its input', () => {
    expect(patchDna(base, { strokeThickness: base.dna.strokeThickness })).toBe(base)
    const frozen = structuredClone(base)
    patchDna(base, { strokeThickness: 140 })
    expect(base).toEqual(frozen)
  })

  it('checkpoint skips duplicates, caps the list and keeps newest first', () => {
    const a = checkpoint(base, 'one', stamp())
    expect(checkpoint(a, 'again', stamp())).toBe(a)
    let f = a
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) f = checkpoint(patchDna(f, { strokeThickness: 40 + i }), `s${i}`, stamp())
    expect(f.history).toHaveLength(HISTORY_LIMIT)
    expect(f.history[0]!.label).toBe(`s${HISTORY_LIMIT + 4}`)
  })

  it('restoreSnapshot restores the design and can itself be undone', () => {
    let f = checkpoint(base, 'start', stamp())
    const startId = f.history[0]!.id
    f = patchDna(f, { strokeThickness: 150 })
    f = restoreSnapshot(f, startId, stamp())
    expect(f.dna).toEqual(base.dna)
    expect(f.history.some((h) => h.label === 'Before restoring' && h.dna.strokeThickness === 150)).toBe(true)
    expect(restoreSnapshot(f, 'missing', stamp())).toBe(f)
  })

  it('switching family loads that family and keeps overrides and a way back', () => {
    let f = setGlyphParams(base, 'H', { widthScale: 1.3 })
    f = patchDna(f, { strokeThickness: 120 })
    const g = switchFamily(f, 'modular', stamp())
    expect(g.dna).toEqual(defaultDna('modular'))
    expect(g.overrides).toEqual(f.overrides)
    expect(g.history[0]!.dna.strokeThickness).toBe(120)
    expect(switchFamily(g, 'modular', stamp())).toBe(g)
  })

  it('resetDna restores family defaults but keeps overrides', () => {
    const f = resetDna(patchDna(setGlyphParams(base, 'H', { widthScale: 1.3 }), { strokeThickness: 150 }), stamp())
    expect(f.dna).toEqual(defaultDna('geometric'))
    expect(f.overrides['H']).toBeDefined()
    expect(f.history).toHaveLength(1)
  })
})

describe('glyph overrides', () => {
  it('merges params, removes them with undefined, and deletes the entry when nothing is left', () => {
    let f = setGlyphParams(base, 'H', { widthScale: 1.2 })
    f = setGlyphParams(f, 'H', { roundness: 0.5 })
    expect(f.overrides['H']!.params).toEqual({ widthScale: 1.2, roundness: 0.5 })
    f = setGlyphParams(f, 'H', { widthScale: undefined })
    expect(f.overrides['H']!.params).toEqual({ roundness: 0.5 })
    f = setGlyphParams(f, 'H', { roundness: undefined })
    expect(f.overrides['H']).toBeUndefined()
  })

  it('spacing overrides are rounded, independent of params, and removable', () => {
    let f = setGlyphSpacing(setGlyphParams(base, 'O', { widthScale: 1.1 }), 'O', { leftBearing: 12.6, advanceWidth: 700 })
    expect(f.overrides['O']).toMatchObject({ leftBearing: 13, advanceWidth: 700, params: { widthScale: 1.1 } })
    f = setGlyphSpacing(f, 'O', { leftBearing: undefined, advanceWidth: undefined })
    expect(f.overrides['O']).toEqual({ params: { widthScale: 1.1 } })
  })

  it('freeze stores the live outline; unfreeze drops only it; reset drops everything on the glyph', () => {
    let f = setGlyphSpacing(base, 'O', { leftBearing: 20 })
    f = freezeGlyph(f, 'O')
    expect(f.overrides['O']!.contours!.length).toBe(2)
    expect(f.overrides['O']!.leftBearing).toBe(20)
    f = unfreezeGlyph(f, 'O')
    expect(f.overrides['O']!.contours).toBeUndefined()
    expect(f.overrides['O']!.leftBearing).toBe(20)
    expect(resetGlyph(f, 'O').overrides['O']).toBeUndefined()
    expect(resetGlyph(base, 'O')).toBe(base)
    expect(freezeGlyph(base, '~')).toBe(base) // cannot freeze a glyph that does not exist
  })

  it('resetAllOverrides clears everything and is a no-op when empty', () => {
    const f = setGlyphParams(setGlyphParams(base, 'A', { widthScale: 1.1 }), 'B', { widthScale: 1.1 })
    expect(resetAllOverrides(f).overrides).toEqual({})
    expect(resetAllOverrides(base)).toBe(base)
  })
})

describe('variants', () => {
  const [c] = exploreVariants(base.dna, 5, 1, 0.3)

  it('save, favourite, rename, apply, delete', () => {
    let f = saveVariant(base, { name: '  Bold-ish  ', dna: c!.dna, origin: c!.origin }, stamp())
    const id = f.variants[0]!.id
    expect(f.variants[0]).toMatchObject({ name: 'Bold-ish', favourite: false, origin: { seed: 5, index: 0, spread: 0.3 } })
    f = toggleFavourite(f, id)
    expect(f.variants[0]!.favourite).toBe(true)
    f = renameVariant(f, id, 'Renamed')
    expect(f.variants[0]!.name).toBe('Renamed')
    expect(renameVariant(f, id, '   ')).toBe(f)
    const applied = applyVariant(f, id, stamp())
    expect(applied.dna).toEqual(c!.dna)
    expect(applied.history[0]!.dna).toEqual(base.dna) // how to go back
    expect(deleteVariant(applied, id).variants).toEqual([])
    expect(applyVariant(f, 'nope', stamp())).toBe(f)
  })

  it('saved variants validate against the schema and the list is capped', () => {
    let f = base
    for (let i = 0; i < VARIANT_LIMIT + 3; i++) f = saveVariant(f, { name: `v${i}`, dna: c!.dna, origin: null }, stamp())
    expect(f.variants).toHaveLength(VARIANT_LIMIT)
    expect(customTypefaceSchema.safeParse(f).success).toBe(true)
  })
})

describe('saving variants under a limit', () => {
  const candidate = () => exploreVariants(createTypeface('t').dna, 1, 1, 0.3)[0]!
  const make = (n: number, limit?: number) => {
    let f = createTypeface('t')
    const c = candidate()
    for (let i = 0; i < n; i++) f = saveVariant(f, { name: `v${i}`, dna: c.dna, origin: null }, stamp(), limit)
    return f
  }

  it('refuses to save past the limit, and never drops a variant already kept', () => {
    const f = make(3, 3)
    expect(f.variants.map((v) => v.name)).toEqual(['v2', 'v1', 'v0'])
    const again = saveVariant(f, { name: 'extra', dna: candidate().dna, origin: null }, stamp(), 3)
    expect(again).toBe(f)
    expect(again.variants.map((v) => v.name)).toEqual(['v2', 'v1', 'v0'])
  })

  it('a favourite kept earlier survives hitting the limit', () => {
    let f = saveVariant(createTypeface('t'), { name: 'keeper', dna: candidate().dna, origin: null, favourite: true }, stamp(), 2)
    f = saveVariant(f, { name: 'b', dna: candidate().dna, origin: null }, stamp(), 2)
    f = saveVariant(f, { name: 'c', dna: candidate().dna, origin: null }, stamp(), 2)
    expect(f.variants.map((v) => v.name).sort()).toEqual(['b', 'keeper'])
  })

  it('a project over a newly lowered limit keeps all its variants; it just cannot add more', () => {
    const f = make(5)
    expect(f.variants).toHaveLength(5)
    expect(saveVariant(f, { name: 'x', dna: candidate().dna, origin: null }, stamp(), 2)).toBe(f)
  })

  it('can never exceed the product ceiling whatever limit is passed', () => {
    expect(make(VARIANT_LIMIT + 5, 5000).variants).toHaveLength(VARIANT_LIMIT)
  })
})
