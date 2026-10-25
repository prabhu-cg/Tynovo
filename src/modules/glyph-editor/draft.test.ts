// @vitest-environment node
import { createTypeface } from '@/modules/typeface-engine/typeface'
import { setGlyphParams, setGlyphSpacing } from '@/modules/typeface-engine/edit'
import { appliedDraft, applyDraft, contextText, generatedDraft, leftBearingOf, rightBearingOf, withAdvance, withLeftBearing, withRightBearing } from './draft'
import { movePoints, pointKey } from './outline'

const face = () => createTypeface('f', 'geometric')

describe('draft bridge', () => {
  it('a fresh glyph’s applied and generated drafts are the same', () => {
    expect(appliedDraft(face(), 'H')).toEqual(generatedDraft(face(), 'H'))
  })
  it('characters with no design have no draft', () => {
    expect(appliedDraft(face(), '~')).toBeNull()
  })
  it('applying an edit freezes the glyph with the edited outline and advance, and the project then reproduces it', () => {
    const f = face()
    const d = appliedDraft(f, 'H')!
    const edited = { contours: movePoints(d.contours, new Set([pointKey(0, 0)]), 7, 0), advanceWidth: d.advanceWidth + 12 }
    const next = applyDraft(f, 'H', edited)
    expect(next.overrides['H']!.contours).toBeDefined()
    expect(appliedDraft(next, 'H')).toEqual(edited)
    expect(f.overrides['H']).toBeUndefined() // input untouched
  })
  it('applying the generated shape again returns the glyph to following the design', () => {
    const f = face()
    const d = appliedDraft(f, 'H')!
    const frozen = applyDraft(f, 'H', { ...d, advanceWidth: d.advanceWidth + 5 })
    expect(frozen.overrides['H']?.contours).toBeDefined()
    const back = applyDraft(frozen, 'H', generatedDraft(frozen, 'H')!)
    expect(back.overrides['H']).toBeUndefined()
  })
  it('reset keeps the glyph’s shape parameters and bearings but drops the frozen outline and its advance', () => {
    let f = setGlyphParams(face(), 'H', { widthScale: 1.2 })
    f = setGlyphSpacing(f, 'H', { leftBearing: 90 })
    const d = appliedDraft(f, 'H')!
    f = applyDraft(f, 'H', { ...d, advanceWidth: d.advanceWidth + 30 })
    const target = generatedDraft(f, 'H')!
    const reset = applyDraft(f, 'H', target)
    expect(reset.overrides['H']).toEqual({ params: { widthScale: 1.2 }, leftBearing: 90 })
    expect(appliedDraft(reset, 'H')).toEqual(target)
  })
})

describe('bearings on the working copy', () => {
  const d = appliedDraft(face(), 'H')!
  it('left bearing moves the outline and the advance, keeping the right bearing', () => {
    const r = rightBearingOf(d)
    const next = withLeftBearing(d, leftBearingOf(d) + 25)
    expect(leftBearingOf(next)).toBe(leftBearingOf(d) + 25)
    expect(rightBearingOf(next)).toBe(r)
  })
  it('right bearing changes only the advance', () => {
    const next = withRightBearing(d, 100)
    expect(rightBearingOf(next)).toBe(100)
    expect(next.contours).toBe(d.contours)
  })
  it('returns the same object when nothing changes, and never a negative advance', () => {
    expect(withLeftBearing(d, leftBearingOf(d))).toBe(d)
    expect(withAdvance(d, d.advanceWidth)).toBe(d)
    expect(withAdvance(d, -50).advanceWidth).toBe(0)
  })
})

describe('context text', () => {
  it('surrounds the glyph with straight stems and rounds', () => {
    expect(contextText('A')).toBe('HHAHH OOAOO')
    expect(contextText('g')).toBe('nngnn oogoo')
    expect(contextText('7')).toBe('00700 11711')
    expect(contextText('?')).toContain('H?H')
  })
})

describe('draftFixes', () => {
  it('offers only repairs that match the problems found, and each one removes its problem', async () => {
    const { validateGlyph } = await import('@/modules/font-validation/glyphs')
    const { deriveMetrics } = await import('@/modules/typeface-engine/dna')
    const { asGlyph, draftFixes } = await import('./draft')
    const f = face()
    const m = deriveMetrics(f.dna)
    const d = appliedDraft(f, 'H')!
    const codesOf = (x: typeof d) => new Set(validateGlyph(asGlyph('H', x), m).map((i) => i.code))

    const reversed = { ...d, contours: d.contours.map((c) => [...c].reverse()) }
    const fix = draftFixes(codesOf(reversed), reversed, f.dna.sidebearing)
    expect(fix.map((x) => x.label)).toEqual(['Fix contour direction'])
    expect(codesOf(fix[0]!.apply(reversed)).has('glyph.winding')).toBe(false)

    const narrow = { ...d, advanceWidth: 300 }
    const fitted = draftFixes(codesOf(narrow), narrow, f.dna.sidebearing)[0]!.apply(narrow)
    expect(codesOf(fitted).has('glyph.overhang')).toBe(false)

    expect(draftFixes(codesOf(d), d, f.dna.sidebearing)).toEqual([])
  })
})
