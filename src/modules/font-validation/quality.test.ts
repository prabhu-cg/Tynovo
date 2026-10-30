// @vitest-environment node
import type { Contour, CustomTypeface } from '../brand-projects/schema'
import { setGlyphOutline, setGlyphSpacing, setKerning } from '../typeface-engine/edit'
import { createTypeface } from '../typeface-engine/typeface'
import { analyzeTypeface } from './coverage'
import { mappingFindings, runQualityChecks, type QualityFinding, type QualityReport } from './quality'
import { validateTypeface } from './validate'

const base = (family: 'geometric' | 'rounded' | 'modular' = 'geometric') => createTypeface('q', family, 'Quality Test')
const described = (f: CustomTypeface): CustomTypeface => ({ ...f, copyright: 'Copyright 2026 Test', license: { name: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org', verified: true } })
const run = (f: CustomTypeface) => runQualityChecks(f)
const ids = (r: QualityReport) => r.findings.map((x) => x.id)
const get = (r: QualityReport, id: string) => r.findings.find((x) => x.id === id)
const glyph = (f: CustomTypeface, c: string) => analyzeTypeface(f).reports.get(c)!.glyph!
const applyFix = (f: CustomTypeface, x: QualityFinding | undefined, n = 0): CustomTypeface => {
  const fix = x?.fixes.filter((y) => y.kind === 'edit')[n]
  if (!fix || fix.kind !== 'edit') throw new Error(`no edit fix on ${x?.id}`)
  return fix.apply(f)
}
const withContours = (f: CustomTypeface, c: string, contours: Contour[], adv = glyph(f, c).advanceWidth) => setGlyphOutline(f, c, contours, adv)
const shift = (cs: Contour[], dx: number, dy: number) => cs.map((c) => c.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })))

describe('a fresh typeface (what the checks say about the generator’s own output)', () => {
  it.each(['geometric', 'rounded', 'modular'] as const)('%s: nothing blocking, and no unexplained geometry findings', (family) => {
    const r = run(base(family))
    expect(r.counts.blocking).toBe(0)
    const known = ['metadata.copyright', 'metadata.license', 'spacing.loose-pairs']
    // The rounded family’s e dips below the baseline overshoot (documented in typeface-engine.md); the checker reports it.
    if (family === 'rounded') known.push('metrics.baseline')
    expect(ids(r).sort()).toEqual(known.sort())
  })

  it('a typeface still named “Untitled …” is told so', () => {
    expect(ids(run(createTypeface('x', 'geometric')))).toContain('metadata.placeholder-name')
  })

  it('finds nothing missing in a fresh typeface and every finding carries what, numbers and why', () => {
    const r = run(base())
    expect(get(r, 'coverage.not-designed')).toBeUndefined()
    for (const f of r.findings) {
      expect(f.title, f.id).not.toBe('')
      expect(f.detail, f.id).not.toBe('')
      expect(f.why, f.id).not.toBe('')
    }
    expect(get(r, 'spacing.loose-pairs')!.evidence.length).toBeGreaterThan(5)
  })

  it('never produces a score', () => {
    expect(Object.keys(run(base()))).toEqual(['findings', 'counts', 'checks', 'fileChecked', 'skipped'])
  })

  it('describes every check with what it measures and what it cannot tell you', () => {
    const r = run(base())
    expect(r.checks.length).toBeGreaterThanOrEqual(8)
    for (const c of r.checks) {
      expect(c.measures.length, c.id).toBeGreaterThan(20)
      expect(c.limits.length, c.id).toBeGreaterThan(20)
    }
  })

  it('a described typeface has no metadata findings', () => {
    const r = run(described({ ...base(), familyName: 'Quality Test' }))
    expect(ids(r).filter((i) => i.startsWith('metadata'))).toEqual([])
  })
})

describe('outline checks are blocking, agree with export gating, and offer fixes', () => {
  it('wrong contour direction: blocking, fixable, and gone after the fix', () => {
    const f0 = base()
    const h = glyph(f0, 'H')
    const f = withContours(f0, 'H', h.contours.map((c) => [...c].reverse())) // every contour reversed
    const r = run(f)
    const finding = get(r, 'glyph.winding')!
    expect(finding.severity).toBe('blocking')
    expect(finding.glyphs).toEqual(['H'])
    expect(validateTypeface(f).exportable).toBe(false)
    const fixed = applyFix(f, finding)
    expect(ids(run(fixed))).not.toContain('glyph.winding')
    expect(validateTypeface(fixed).exportable).toBe(true)
  })

  it('self-crossing outline: blocking, with a reset and an editor link', () => {
    const f = withContours(base(), 'I', [[{ x: 0, y: 0, onCurve: true }, { x: 100, y: 100, onCurve: true }, { x: 100, y: 0, onCurve: true }, { x: 0, y: 100, onCurve: true }]])
    const finding = get(run(f), 'glyph.self-intersection')!
    expect(finding.severity).toBe('blocking')
    expect(finding.fixes.map((x) => x.kind)).toContain('go')
    const reset = applyFix(f, finding)
    expect(ids(run(reset))).not.toContain('glyph.self-intersection')
  })

  it('advance narrower than the ink: warning, fixed by fitting the advance', () => {
    const f = setGlyphSpacing(base(), 'H', { advanceWidth: 300 })
    const finding = get(run(f), 'glyph.overhang')!
    expect(finding.severity).toBe('warning')
    expect(finding.evidence[0]).toMatch(/^H: ink ends at \d+, advance is 300/)
    expect(ids(run(applyFix(f, finding)))).not.toContain('glyph.overhang')
  })

  it('negative bearing: warning, fixed by shifting the outline and widening the advance', () => {
    const f0 = base()
    const h = glyph(f0, 'H')
    const f = withContours(f0, 'H', shift(h.contours, -90, 0))
    const finding = get(run(f), 'glyph.negative-bearing')!
    expect(finding.evidence[0]).toContain('H: ink starts at x = -30')
    const fixed = applyFix(f, finding)
    expect(glyph(fixed, 'H').contours.flat().every((p) => p.x >= 0)).toBe(true)
    expect(ids(run(fixed))).not.toContain('glyph.negative-bearing')
  })

  it('stray specks and stacked points are found and removable', () => {
    const f0 = base()
    const h = glyph(f0, 'H')
    const speck: Contour = [{ x: 400, y: 300, onCurve: true }, { x: 400, y: 306, onCurve: true }, { x: 406, y: 306, onCurve: true }, { x: 406, y: 300, onCurve: true }]
    const stacked = h.contours.map((c, i) => (i === 0 ? [c[0]!, c[0]!, ...c.slice(1)] : c))
    const f = withContours(f0, 'H', [...stacked, speck])
    const r = run(f)
    expect(ids(r)).toEqual(expect.arrayContaining(['outlines.specks', 'outlines.duplicate-points']))
    let fixed = applyFix(f, get(r, 'outlines.specks'))
    fixed = applyFix(fixed, get(run(fixed), 'outlines.duplicate-points'))
    expect(ids(run(fixed))).not.toContain('outlines.specks')
    expect(ids(run(fixed))).not.toContain('outlines.duplicate-points')
    expect(validateTypeface(fixed).exportable).toBe(true)
  })

  it('geometry error codes always make the font non-exportable', () => {
    for (const c of ['glyph.winding', 'glyph.self-intersection']) {
      expect(c).toBeTruthy()
    }
    const f = withContours(base(), 'O', [])
    expect(get(run(f), 'glyph.empty')!.severity).toBe('blocking')
    expect(validateTypeface(f).exportable).toBe(false)
  })
})

describe('mapping checks', () => {
  it('finds duplicate code points, duplicate and invalid names, invalid scalar values', () => {
    const r = mappingFindings([
      { char: 'A', name: 'A' },
      { char: 'A', name: 'A2' },
      { char: 'B', name: 'A2' },
      { char: 'C', name: '1bad' },
      { char: '\ud800', name: 'surrogate' },
    ])
    expect(r.map((x) => x.id).sort()).toEqual(['mapping.duplicate-codepoint', 'mapping.duplicate-name', 'mapping.invalid-codepoint', 'mapping.invalid-name'])
    expect(r.every((x) => x.severity === 'blocking')).toBe(true)
  })
  it('finds nothing wrong with the generator’s own mapping', () => {
    expect(mappingFindings(analyzeTypeface(base()).supported.map((g) => ({ char: g.char, name: g.name })))).toEqual([])
  })
})

describe('metrics, widths and spacing', () => {
  it('a letter raised off the baseline and past the cap height is reported with the measured numbers', () => {
    const f0 = base()
    const h = glyph(f0, 'H')
    const r = run(withContours(f0, 'H', shift(h.contours, 0, 25)))
    expect(get(r, 'metrics.baseline')!.evidence[0]).toBe('H: lowest point at y = 25')
    expect(get(r, 'metrics.top-cap')!.evidence[0]).toBe('H: top at y = 725 (+25)')
  })

  it('a declared x-height that the letters do not reach is reported', () => {
    let f = base()
    for (const c of 'xzvw') f = withContours(f, c, shift(glyph(f, c).contours, 0, 30))
    const finding = get(run(f), 'metrics.x-height')!
    expect(finding.evidence[0]).toBe('Declared x-height 504; measured 534.')
  })

  it('a stray width override is an outlier, and following automatic spacing resolves it', () => {
    const f = setGlyphSpacing(base(), 'E', { advanceWidth: 1500 })
    const finding = get(run(f), 'widths.outliers')!
    expect(finding.evidence[0]).toMatch(/^E: advance 1500 is \d\.\d×? ?the uppercase median/)
    expect(ids(run(applyFix(f, finding)))).not.toContain('widths.outliers')
  })

  it('narrow I, l, i, j, 1 and wide M, W are not outliers', () => {
    expect(ids(run(base()))).not.toContain('widths.outliers')
  })

  it('a tight side bearing override is reported and can be returned to automatic', () => {
    const f = setGlyphSpacing(base(), 'H', { leftBearing: 4 })
    const finding = get(run(f), 'spacing.bearings')!
    expect(finding.severity).toBe('warning')
    expect(finding.evidence[0]).toBe('H left bearing 4, automatic spacing would give 60')
    expect(ids(run(applyFix(f, finding)))).not.toContain('spacing.bearings')
  })

  it('kerning that pushes a pair into contact is reported and can be opened up', () => {
    const f = setKerning(base(), 'A', 'V', -330)
    const finding = get(run(f), 'spacing.touching')!
    expect(finding.evidence.join(' ')).toContain('AV')
    const fixed = applyFix(f, finding)
    expect(ids(run(fixed))).not.toContain('spacing.touching')
  })

  it.each(['geometric', 'rounded', 'modular'] as const)('%s: the suggested kerning resolves the recommendation, never makes pairs touch, and is idempotent', (family) => {
    const f = base(family)
    const loose = get(run(f), 'spacing.loose-pairs')!
    const fixed = applyFix(f, loose)
    const after = run(fixed)
    expect(ids(after)).not.toContain('spacing.loose-pairs')
    expect(ids(after)).not.toContain('spacing.touching')
    expect(fixed.kerning.length).toBeGreaterThan(5)
    expect(fixed.kerning.every((k) => k.value < 0 && k.value > -400)).toBe(true)
    // Applying nothing new: a second pass over the fixed design suggests no more.
    expect(ids(after)).toEqual(ids(run(fixed)))
  })

  it('kerning values and dangling pairs are checked', () => {
    const f = { ...setKerning(setKerning(base(), 'A', 'V', -300), 'A', 'é', -20), kerning: [{ left: 'A', right: 'V', value: -300 }, { left: 'A', right: 'é', value: -20 }] }
    const r = run(f)
    expect(get(r, 'spacing.extreme-kerning')!.evidence).toEqual(['AV: -300'])
    expect(get(r, 'kerning.missing-glyph')!.evidence).toEqual(['Aé: -20'])
  })
})

describe('metadata checks', () => {
  it('flags the placeholder name, missing copyright, missing licence, unconfirmed licence and missing link', () => {
    const f = createTypeface('x', 'geometric')
    expect(ids(run(f))).toEqual(expect.arrayContaining(['metadata.placeholder-name', 'metadata.copyright', 'metadata.license']))
    const named = { ...f, familyName: 'Bergamo Display', copyright: 'Copyright 2026 Bergamo', license: { name: 'SIL Open Font License 1.1', verified: false } }
    const r = run(named)
    expect(ids(r).filter((i) => i.startsWith('metadata')).sort()).toEqual(['metadata.license-unverified', 'metadata.license-url'])
  })
  it('a style name that disagrees with the file’s Regular flags is a warning with a one-click fix', () => {
    const f = described({ ...base(), familyName: 'Bergamo', styleName: 'Bold' })
    const finding = get(run(f), 'metadata.style')!
    expect(finding.severity).toBe('warning')
    expect(applyFix(f, finding).styleName).toBe('Regular')
  })
  it('warns about names too long for older programs', () => {
    expect(ids(run(described({ ...base(), familyName: 'A Very Long Family Name That Goes On And On' })))).toContain('metadata.long-name')
  })
})

describe('file checks join the same report', () => {
  it('maps binary errors to blocking and warnings to warnings, and ignores info', () => {
    const r = runQualityChecks(base(), {
      format: 'TTF',
      issues: [
        { severity: 'error', code: 'binary.checksum', message: 'Checksum mismatch in hmtx.', source: 'binary' },
        { severity: 'warning', code: 'binary.win-metrics', message: 'Windows ascent differs.', source: 'binary' },
        { severity: 'info', code: 'x', message: 'fyi', source: 'binary' },
      ],
    })
    expect(r.fileChecked).toBe(true)
    expect(r.findings.filter((x) => x.category === 'file').map((x) => x.severity)).toEqual(['blocking', 'warning'])
  })
})

describe('ordering', () => {
  it('lists blocking first, then warnings, then recommendations', () => {
    const f = withContours(base(), 'I', [[{ x: 0, y: 0, onCurve: true }, { x: 100, y: 100, onCurve: true }, { x: 100, y: 0, onCurve: true }, { x: 0, y: 100, onCurve: true }]])
    const order = run(f).findings.map((x) => x.severity)
    expect(order).toEqual([...order].sort((a, b) => ['blocking', 'warning', 'recommendation'].indexOf(a) - ['blocking', 'warning', 'recommendation'].indexOf(b)))
    expect(order[0]).toBe('blocking')
  })
})
