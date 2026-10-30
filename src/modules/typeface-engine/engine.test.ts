// @vitest-environment node
import type { CustomTypeface, Dna, Glyph } from '../brand-projects/schema'
import { analyzeTypeface } from '../font-validation/coverage'
import { isClockwise } from '../glyph-editor/geometry'
import { defaultDna, deriveMetrics, DNA_CONTROLS, type Family } from './dna'
import { patchDna, resetGlyph, setGlyphParams, setGlyphSpacing, freezeGlyph } from './edit'
import { clearGeneratorCache, generateGlyph, generateTypeface } from './generate'
import { createTypeface } from './typeface'
import { rng } from './variants'

const FAMILIES: Family[] = ['geometric', 'rounded', 'modular']
const glyphOf = (dna: Dna, ch: string): Glyph => {
  const r = generateGlyph(dna, ch)
  if (!r.ok) throw new Error(r.message)
  return r.glyph
}
const bbox = (g: Glyph) => {
  const pts = g.contours.flat()
  return { minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)), minY: Math.min(...pts.map((p) => p.y)), maxY: Math.max(...pts.map((p) => p.y)) }
}
const faceOf = (family: Family, patch: Partial<Dna> = {}): CustomTypeface => {
  const t = createTypeface('t', family)
  return { ...t, dna: { ...t.dna, ...patch } }
}

describe('determinism', () => {
  it.each(FAMILIES)('%s: identical settings give identical glyphs, with or without the cache', (family) => {
    const dna = defaultDna(family)
    const a = JSON.stringify(generateTypeface({ dna, overrides: {} }))
    clearGeneratorCache()
    const b = JSON.stringify(generateTypeface({ dna: structuredClone(dna), overrides: {} }))
    expect(b).toBe(a)
  })

  it('the seeded generator repeats and differs by seed', () => {
    const run = (seed: number) => Array.from({ length: 5 }, ((r) => () => r())(rng(seed)))
    expect(run(7)).toEqual(run(7))
    expect(run(7)).not.toEqual(run(8))
  })
})

describe('character coverage', () => {
  it.each(FAMILIES)('%s: reports exactly what is supported and what is missing', (family) => {
    const a = analyzeTypeface(faceOf(family))
    const byId = Object.fromEntries(a.groups.map((g) => [g.id, g]))
    expect(byId['upper']).toMatchObject({ supported: 26, total: 26, invalid: [], missing: [] })
    expect(byId['lower']).toMatchObject({ supported: 26, total: 26, invalid: [], missing: [] })
    expect(byId['digits']).toMatchObject({ supported: 10, total: 10, invalid: [], missing: [] })
    expect(byId['space']).toMatchObject({ supported: 1, total: 1 })
    expect(byId['punctuation']).toMatchObject({ supported: 32, total: 32, invalid: [], missing: [] })
    expect(a.supportedCount).toBe(95)
    expect(a.supported).toHaveLength(a.supportedCount)
  })

  it('names a character outside the Latin ASCII set as having no recipe, and says why', () => {
    for (const c of ['é', 'ñ', 'Ω', 'あ']) expect(generateGlyph(defaultDna('geometric'), c), c).toMatchObject({ ok: false, reason: 'no-recipe' })
    expect(generateGlyph(defaultDna('geometric'), 'é')).toMatchObject({ message: expect.stringContaining('No recipe') })
  })

  it('a frozen outline that fails validation is reported as invalid, not hidden or exported', () => {
    const face = faceOf('geometric')
    const bad = { ...face, overrides: { H: { contours: [[{ x: 0, y: 0, onCurve: true }, { x: 100, y: 0, onCurve: true }, { x: 0, y: 100, onCurve: true }]] } } } // counter-clockwise outer
    const a = analyzeTypeface(bad)
    expect(a.reports.get('H')!.status).toBe('invalid')
    expect(a.supported.some((g) => g.char === 'H')).toBe(false)
  })
})

describe('representative geometry (geometric family, defaults)', () => {
  const dna = defaultDna('geometric')
  const m = deriveMetrics(dna)

  it('metrics are consistent', () => {
    expect(m).toEqual({ unitsPerEm: 1000, ascender: 742, descender: -212, lineGap: 0, capHeight: 700, xHeight: 504 })
  })

  it('I is one stem sitting on the baseline with symmetrical sidebearings', () => {
    const g = glyphOf(dna, 'I')
    expect(g.contours).toHaveLength(1)
    expect(g.contours[0]).toHaveLength(4)
    expect(bbox(g)).toEqual({ minX: 60, maxX: 150, minY: 0, maxY: 700 })
    expect(g.advanceWidth).toBe(60 + 90 + 60)
    expect(isClockwise(g.contours[0]!)).toBe(true)
  })

  it('H has equal sidebearings and a crossbar at mid-height', () => {
    const g = glyphOf(dna, 'H')
    const b = bbox(g)
    expect(b.minX).toBe(g.advanceWidth - b.maxX)
    expect(g.contours).toHaveLength(1)
    const ys = g.contours[0]!.map((p) => p.y)
    expect(ys).toContain(350 - 45)
    expect(ys).toContain(350 + 45)
  })

  it('O is a ring: clockwise outer, counter-clockwise counter, overshooting both lines', () => {
    const g = glyphOf(dna, 'O')
    expect(g.contours).toHaveLength(2)
    const [outer, counter] = g.contours.length === 2 && Math.abs(areaOf(g.contours[0]!)) > Math.abs(areaOf(g.contours[1]!)) ? g.contours : [g.contours[1]!, g.contours[0]!]
    expect(isClockwise(outer!)).toBe(true)
    expect(isClockwise(counter!)).toBe(false)
    expect(bbox(g)).toMatchObject({ minY: -12, maxY: 712 })
  })

  it('x-height, ascender and descender glyphs land on their metrics', () => {
    expect(bbox(glyphOf(dna, 'x'))).toMatchObject({ minY: 0, maxY: 504 })
    expect(bbox(glyphOf(dna, 'o'))).toMatchObject({ minY: -12, maxY: 516 })
    expect(bbox(glyphOf(dna, 'l')).maxY).toBe(730)
    expect(bbox(glyphOf(dna, 'p')).minY).toBe(-200)
    expect(bbox(glyphOf(dna, 'b')).maxY).toBe(730)
  })

  it('i has a separate dot above the x-height', () => {
    const g = glyphOf(dna, 'i')
    expect(g.contours).toHaveLength(2)
    expect(Math.max(...g.contours.flat().map((p) => p.y))).toBeGreaterThan(504)
  })

  it('space has no outline and uses the space width', () => {
    expect(glyphOf(dna, ' ')).toMatchObject({ contours: [], advanceWidth: 280 })
  })

  it('diagonal letters are spaced tighter than stem letters', () => {
    const bearing = (ch: string) => bbox(glyphOf(dna, ch)).minX
    expect(bearing('A')).toBeLessThan(bearing('H'))
    expect(bearing('V')).toBeLessThan(bearing('H'))
    expect(bearing('O')).toBeLessThan(bearing('H'))
  })

  it('digit 9 is digit 6 turned half way round', () => {
    const six = glyphOf(dna, '6')
    const nine = glyphOf(dna, '9')
    const a = bbox(six)
    const b = bbox(nine)
    expect(b.maxX - b.minX).toBe(a.maxX - a.minX)
    expect(b.maxY - b.minY).toBe(a.maxY - a.minY)
    expect(nine.contours.flat().length).toBe(six.contours.flat().length)
  })

  it('modular family keeps ink widths on its grid and chamfers corners', () => {
    const mod = defaultDna('modular')
    const h = bbox(glyphOf(mod, 'H'))
    expect((h.maxX - h.minX) % mod.grid).toBe(0)
    const i = glyphOf(mod, 'I')
    expect(i.contours[0]!.length).toBeGreaterThan(4) // chamfered ends
  })

  it('rounded family rounds the stem ends', () => {
    expect(glyphOf(defaultDna('rounded'), 'I').contours[0]!.length).toBeGreaterThan(4)
    expect(glyphOf(defaultDna('geometric'), 'I').contours[0]).toHaveLength(4)
  })
})

function areaOf(c: Glyph['contours'][number]) {
  let s = 0
  for (let i = 0; i < c.length; i++) {
    const a = c[i]!
    const b = c[(i + 1) % c.length]!
    s += a.x * b.y - b.x * a.y
  }
  return s / 2
}

describe('symbols & @ { } ~', () => {
  const dna = defaultDna('geometric')
  const m = deriveMetrics(dna)
  const holes = (g: Glyph) => g.contours.filter((c) => !isClockwise(c)).length

  it.each(['&', '@', '{', '}', '~'])('%s stays inside the font’s vertical metrics', (ch) => {
    const b = bbox(glyphOf(dna, ch))
    expect(b.maxY).toBeLessThanOrEqual(m.ascender)
    expect(b.minY).toBeGreaterThanOrEqual(m.descender)
  })

  it('& is two bowls (two counters), @ has the inner bowl counter, braces and tilde are solid', () => {
    expect(holes(glyphOf(dna, '&'))).toBeGreaterThanOrEqual(2)
    expect(holes(glyphOf(dna, '@'))).toBeGreaterThanOrEqual(1)
    for (const ch of ['{', '}', '~']) expect(holes(glyphOf(dna, ch)), ch).toBe(0)
  })

  it('} is { turned round: same height and same ink width', () => {
    const l = bbox(glyphOf(dna, '{'))
    const r = bbox(glyphOf(dna, '}'))
    expect(r.maxY - r.minY).toBe(l.maxY - l.minY)
    expect(r.maxX - r.minX).toBe(l.maxX - l.minX)
  })

  it('the tilde sits around the middle of the x-height, between the baseline and the x-height line', () => {
    const b = bbox(glyphOf(dna, '~'))
    expect(b.minY).toBeGreaterThan(0)
    expect(b.maxY).toBeLessThan(m.xHeight)
  })
})

describe('parameters reach the glyphs they should', () => {
  const visible = (face: CustomTypeface) => analyzeTypeface(face).supported.filter((g) => g.char !== ' ')
  // The space glyph is the one thing spaceWidth affects, so it counts there and nowhere else.
  const all = (face: CustomTypeface) => analyzeTypeface(face).supported
  const changed = (family: Family, key: keyof Dna, value: number | string) => {
    const pick = key === 'spaceWidth' ? all : visible
    const base = pick(faceOf(family))
    const next = pick(faceOf(family, { [key]: value } as Partial<Dna>))
    return base.filter((g) => JSON.stringify(g) !== JSON.stringify(next.find((n) => n.char === g.char))).map((g) => g.char)
  }

  it('every numeric control changes at least one glyph (no dead parameters)', () => {
    for (const c of DNA_CONTROLS) {
      // Corner parameters only act with a corner style; test them on the family that uses one.
      const family: Family = c.key === 'cornerRadius' || c.key === 'innerCornerRatio' ? 'rounded' : c.key === 'grid' ? 'modular' : 'geometric'
      const base = defaultDna(family)[c.key] as number
      const target = base === c.max ? c.min : base === c.min ? c.max : c.max
      const target2 = c.key === 'grid' ? 20 : target
      expect(changed(family, c.key, target2).length, `${c.key} (${family})`).toBeGreaterThan(0)
    }
  })

  it('corner style and terminal style change glyphs', () => {
    expect(changed('geometric', 'cornerStyle', 'chamfer').length).toBe(0) // radius 0: nothing to soften
    expect(changed('rounded', 'cornerStyle', 'chamfer').length).toBeGreaterThan(20)
    // An angled cut is perpendicular to the stroke: where the stroke is vertical (the terminals of s) that is the flat cut.
    expect(changed('geometric', 'terminal', 'angled')).toEqual(expect.arrayContaining(['C', 'S', 'c', 'e', 'G']))
    expect(changed('geometric', 'terminal', 'round')).toEqual(expect.arrayContaining(['C', 'S', 'c', 's', 'e', 'G']))
  })

  it('stroke thickness reaches every visible glyph', () => {
    const base = visible(faceOf('geometric'))
    const next = visible(faceOf('geometric', { strokeThickness: 140 }))
    for (const g of base) expect(JSON.stringify(next.find((n) => n.char === g.char)), g.char).not.toBe(JSON.stringify(g))
  })

  it('cap height moves capitals, x-height moves lowercase, and neither touches the other', () => {
    const base = faceOf('geometric')
    const tall = faceOf('geometric', { capHeight: 800 })
    expect(bbox(glyphOf(tall.dna, 'H')).maxY).toBe(800)
    expect(bbox(glyphOf(tall.dna, 'x')).maxY).toBe(Math.round(800 * 0.72))
    const flat = faceOf('geometric', { xHeightRatio: 0.6 })
    expect(bbox(glyphOf(flat.dna, 'x')).maxY).toBe(420)
    expect(JSON.stringify(glyphOf(flat.dna, 'H'))).toBe(JSON.stringify(glyphOf(base.dna, 'H')))
  })

  it('width scale widens letters but not stroke thickness', () => {
    const wide = faceOf('geometric', { widthScale: 1.4 })
    const base = faceOf('geometric')
    const w = (f: CustomTypeface) => { const b = bbox(glyphOf(f.dna, 'H')); return b.maxX - b.minX }
    expect(w(wide)).toBeGreaterThan(w(base))
    const stem = (f: CustomTypeface) => { const b = bbox(glyphOf(f.dna, 'I')); return b.maxX - b.minX }
    expect(stem(wide)).toBe(stem(base))
  })

  it('contrast thins horizontals only', () => {
    const thin = faceOf('geometric', { contrast: 0.6 })
    const h = glyphOf(thin.dna, 'H')
    const ys = [...new Set(h.contours[0]!.map((p) => p.y))].sort((a, b) => a - b)
    const bar = ys.filter((y) => y > 300 && y < 400)
    expect(bar[1]! - bar[0]!).toBe(Math.round(90 * 0.6))
    const i = bbox(glyphOf(thin.dna, 'I'))
    expect(i.maxX - i.minX).toBe(90)
  })
})

describe('per-glyph overrides', () => {
  const base = faceOf('geometric')
  const others = (f: CustomTypeface) => generateTypeface(f).glyphs.filter((g) => g.char !== 'H')

  it('a glyph override changes only that glyph', () => {
    const f = setGlyphParams(base, 'H', { widthScale: 1.5 })
    expect(others(f)).toEqual(others(base))
    const w = (face: CustomTypeface) => { const b = bbox(generateGlyph(face.dna, 'H', face.overrides['H']).ok ? (generateGlyph(face.dna, 'H', face.overrides['H']) as { glyph: Glyph }).glyph : ({} as Glyph)); return b.maxX - b.minX }
    expect(w(f)).toBeGreaterThan(w(base))
  })

  it('global changes keep every override and still apply on top of it', () => {
    let f = setGlyphParams(base, 'H', { widthScale: 1.5 })
    f = setGlyphSpacing(f, 'O', { leftBearing: 5 })
    const overrides = structuredClone(f.overrides)
    f = patchDna(f, { strokeThickness: 130, roundness: 0.5, cornerStyle: 'chamfer', cornerRadius: 40 })
    expect(f.overrides).toEqual(overrides)
    const h = (generateGlyph(f.dna, 'H', f.overrides['H']) as { glyph: Glyph }).glyph
    const plainH = (generateGlyph(f.dna, 'H') as { glyph: Glyph }).glyph
    const width = (g: Glyph) => bbox(g).maxX - bbox(g).minX
    expect(width(h)).toBeGreaterThan(width(plainH)) // still wider, with the new stroke
    expect((generateGlyph(f.dna, 'O', f.overrides['O']) as { glyph: Glyph }).glyph.contours.flat().some((p) => p.x === 5)).toBe(true)
  })

  it('a frozen outline ignores later shape changes but keeps its spacing override', () => {
    let f = freezeGlyph(base, 'O')
    const frozen = (generateGlyph(f.dna, 'O', f.overrides['O']) as { glyph: Glyph }).glyph
    f = patchDna(f, { strokeThickness: 150, roundness: 0.3 })
    const after = (generateGlyph(f.dna, 'O', f.overrides['O']) as { glyph: Glyph }).glyph
    expect(after.contours).toEqual(frozen.contours)
    const other = (generateGlyph(f.dna, 'H', f.overrides['H']) as { glyph: Glyph }).glyph
    expect(other).not.toEqual((generateGlyph(base.dna, 'H') as { glyph: Glyph }).glyph)
  })

  it('only an explicit reset removes an override', () => {
    let f = setGlyphParams(base, 'H', { widthScale: 1.5 })
    f = patchDna(f, { widthScale: 0.8 })
    expect(f.overrides['H']).toBeDefined()
    f = resetGlyph(f, 'H')
    expect(f.overrides['H']).toBeUndefined()
  })
})

describe('validity sweeps: every supported glyph must pass validation', () => {
  const problems = (dna: Dna) => [...analyzeTypeface({ dna, overrides: {} }).reports.values()].filter((r) => r.status === 'invalid' || (r.status === 'missing' && r.reason !== 'no-recipe'))
  const describeProblems = (label: string, dna: Dna) => problems(dna).map((p) => `${label} ${p.char}: ${p.status === 'invalid' ? p.issues.map((i) => i.code).join('+') : p.message}`)

  it('single-parameter extremes, all families', { timeout: 120_000 }, () => {
    const found: string[] = []
    for (const family of FAMILIES) {
      for (const c of DNA_CONTROLS) {
        for (const f of [0, 0.5, 1]) {
          let v = Math.round((c.min + (c.max - c.min) * f) / c.step) * c.step
          v = Math.min(c.max, Math.max(c.min, +v.toFixed(3)))
          if (c.key === 'grid' && v !== 0 && v < 10) v = 10
          found.push(...describeProblems(`${family} ${c.key}=${v}`, { ...defaultDna(family), [c.key]: v }))
        }
      }
    }
    expect(found).toEqual([])
  })

  it('seeded random combinations of every parameter', { timeout: 180_000 }, () => {
    const found: string[] = []
    for (const family of FAMILIES) {
      const rnd = rng(family.length * 977)
      for (let i = 0; i < 40; i++) {
        const dna: Record<string, unknown> = { ...defaultDna(family) }
        for (const c of DNA_CONTROLS) {
          let v = Math.round((c.min + (c.max - c.min) * rnd()) / c.step) * c.step
          v = Math.min(c.max, Math.max(c.min, +v.toFixed(3)))
          if (c.key === 'grid' && v !== 0 && v < 10) v = rnd() < 0.5 ? 0 : 10
          dna[c.key] = v
        }
        dna['cornerStyle'] = (['sharp', 'round', 'chamfer'] as const)[Math.floor(rnd() * 3)]
        dna['terminal'] = (['flat', 'angled', 'round'] as const)[Math.floor(rnd() * 3)]
        found.push(...describeProblems(`${family}#${i} ${JSON.stringify(dna)}`, dna as Dna))
      }
    }
    expect(found).toEqual([])
  })
})
