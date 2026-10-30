// @vitest-environment node
import type { Contour, CustomTypeface } from '../brand-projects/schema'
import { patchDna } from '../typeface-engine/edit'
import { createTypeface } from '../typeface-engine/typeface'
import { ENGINE_VERSION } from '../typeface-engine/version'
import { analyzeTypeface, describeCoverage } from './coverage'
import { validateGlyph } from './glyphs'
import { validateFontBinary, validateTypeface } from './validate'
import { deriveMetrics } from '../typeface-engine/dna'

const face = () => createTypeface('f', 'geometric')
const pt = (x: number, y: number) => ({ x, y, onCurve: true })
const withContours = (char: string, contours: Contour[]): CustomTypeface => ({ ...face(), overrides: { [char]: { contours } } })
const codes = (f: CustomTypeface) => validateTypeface(f).issues.map((i) => `${i.code}:${i.glyph ?? ''}`)

describe('validateTypeface', () => {
  it('a fresh typeface is exportable, covers every target character, and has no errors', () => {
    const r = validateTypeface(face())
    expect(r.exportable).toBe(true)
    expect(r.errorCount).toBe(0)
    expect(r.issues.some((i) => i.code === 'coverage.missing')).toBe(false)
    expect(r.issues.some((i) => i.code === 'license.unverified')).toBe(true)
  })

  it('reports a glyph with the wrong winding as an error against that character', () => {
    const f = withContours('H', [[pt(0, 0), pt(100, 0), pt(100, 700), pt(0, 700)]]) // counter-clockwise outer
    expect(codes(f)).toContain('glyph.winding:H')
    expect(validateTypeface(f).exportable).toBe(false)
  })

  it('reports self-intersecting outlines', () => {
    const f = withContours('I', [[pt(0, 0), pt(100, 100), pt(100, 0), pt(0, 100)]])
    expect(codes(f)).toContain('glyph.self-intersection:I')
  })

  it('reports counters that are not inside solid area, empty glyphs and glyphs beyond the metrics', () => {
    const outerCw: Contour = [pt(0, 0), pt(0, 300), pt(300, 300), pt(300, 0)]
    const stray: Contour = [pt(500, 100), pt(700, 100), pt(700, 200), pt(500, 200)] // counter-clockwise, but nowhere near the outer
    expect(codes(withContours('O', [outerCw, stray]))).toContain('glyph.winding:O')
    expect(codes(withContours('L', []))).toContain('glyph.empty:L')
    expect(codes(withContours('I', [[pt(0, 0), pt(0, 2000), pt(90, 2000), pt(90, 0)]]))).toContain('glyph.outside-metrics:I')
  })

  it('warns about kerning for glyphs that are not in the font and about unverified licences', () => {
    const f = { ...face(), kerning: [{ left: 'A', right: 'é', value: -10 }] }
    expect(codes(f)).toContain('kerning.missing-glyph:')
    expect(codes({ ...f, license: { name: 'OFL', verified: true } })).not.toContain('license.unverified:')
  })

  it('notes a generator-version mismatch without blocking export', () => {
    expect(codes({ ...face(), engineVersion: ENGINE_VERSION + 1 })).toContain('engine.newer:')
    const older = validateTypeface({ ...face(), engineVersion: 0 + 1 })
    expect(older.exportable).toBe(true)
  })

  it('surfaces DNA warnings (stroke limited, unused corner radius)', () => {
    expect(codes(patchDna(face(), { strokeThickness: 200, contrast: 1.3 }))).toContain('dna.stroke-clamped:')
    expect(codes(patchDna(face(), { cornerRadius: 40 }))).toContain('dna.corner-unused:')
  })
})

describe('coverage analysis', () => {
  it('only supported glyphs are exportable, and the description is derived from the analysis', () => {
    const f = withContours('H', [[pt(0, 0), pt(100, 0), pt(100, 700), pt(0, 700)]])
    const a = analyzeTypeface(f)
    expect(a.reports.get('H')!.status).toBe('invalid')
    expect(a.supported.map((g) => g.char)).not.toContain('H')
    expect(a.supportedCount).toBe(94)
    expect(describeCoverage(a)).toContain('94 of 95')
    expect(a.groups.find((g) => g.id === 'upper')!.invalid).toEqual(['H'])
  })

  it('is memoised on the typeface object', () => {
    const f = face()
    expect(analyzeTypeface(f)).toBe(analyzeTypeface(f))
  })
})

describe('validateGlyph', () => {
  const m = deriveMetrics(face().dna)
  it('flags fractional and non-finite coordinates', () => {
    const base = { char: 'I', name: 'I', advanceWidth: 200, contours: [[pt(0, 0), pt(0, 700), pt(90.5, 700), pt(90, 0)]] }
    expect(validateGlyph(base, m).map((i) => i.code)).toContain('glyph.fractional')
    const inf = { ...base, contours: [[pt(0, 0), pt(0, Infinity), pt(90, 700), pt(90, 0)]] }
    expect(validateGlyph(inf, m).map((i) => i.code)).toContain('glyph.non-finite')
  })
  it('warns about overhang and negative bearings', () => {
    const g = { char: 'I', name: 'I', advanceWidth: 50, contours: [[pt(-10, 0), pt(-10, 700), pt(80, 700), pt(80, 0)]] }
    const codes = validateGlyph(g, m).map((i) => i.code)
    expect(codes).toEqual(expect.arrayContaining(['glyph.negative-bearing', 'glyph.overhang']))
  })
})

describe('validateFontBinary', () => {
  it('reports errors for bytes that are not a font instead of passing', async () => {
    const r = await validateFontBinary(new Uint8Array([1, 2, 3, 4]))
    expect(r.exportable).toBe(false)
    expect(r.issues[0]).toMatchObject({ severity: 'error', code: 'TOO_SHORT', source: 'binary' })
  })
})
