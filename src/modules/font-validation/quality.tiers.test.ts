import { describe, expect, it } from 'vitest'
import { createTypeface } from '@/modules/typeface-engine/typeface'
import { defaultDna } from '@/modules/typeface-engine/dna'
import { CHECKS, runQualityChecks } from './quality'

const square = [{ x: 0, y: 0, onCurve: true }, { x: 1, y: 0, onCurve: true }, { x: 2, y: 0, onCurve: true }]

/** Designs that produce findings of every kind, including blocking ones. */
function designs() {
  const base = createTypeface('t', 'geometric')
  return [
    base,
    { ...base, dna: { ...base.dna, strokeThickness: 190, widthScale: 1.55, sidebearing: 12, xHeightRatio: 0.52 } },
    { ...base, dna: defaultDna('modular'), overrides: { H: { advanceWidth: 2500 }, e: { contours: [square] } } },
    { ...base, familyName: '', overrides: { O: { contours: [square] }, A: { leftBearing: -250 } } },
  ]
}

describe('quality diagnostics by plan', () => {
  it('labels each check as core or extended, and the extended ones are metrics, widths and spacing', () => {
    expect(CHECKS.filter((c) => c.info.tier === 'extended').map((c) => c.info.id)).toEqual(['alignment', 'widths', 'spacing'])
    expect(CHECKS.filter((c) => c.info.tier === 'core').map((c) => c.info.id)).toEqual(['coverage', 'geometry', 'mapping', 'metadata'])
  })

  it('without the extended checks, every blocking finding is still reported: nothing that stops an export is ever left out', () => {
    for (const face of designs()) {
      const full = runQualityChecks(face)
      const core = runQualityChecks(face, undefined, { extended: false })
      const blocking = (r: typeof full) => r.findings.filter((f) => f.severity === 'blocking').map((f) => f.id).sort()
      expect(blocking(core)).toEqual(blocking(full))
      expect(core.counts.blocking).toBe(full.counts.blocking)
    }
  })

  it('extended checks only ever give advice, never a blocking finding', () => {
    for (const face of designs()) {
      const full = runQualityChecks(face)
      const core = runQualityChecks(face, undefined, { extended: false })
      const coreIds = new Set(core.findings.map((f) => f.id))
      for (const f of full.findings) if (!coreIds.has(f.id)) expect(f.severity, f.id).not.toBe('blocking')
    }
  })

  it('says which checks were skipped, and runs everything by default', () => {
    const face = createTypeface('t', 'geometric')
    expect(runQualityChecks(face).skipped).toEqual([])
    const core = runQualityChecks(face, undefined, { extended: false })
    expect(core.skipped.map((c) => c.id)).toEqual(['alignment', 'widths', 'spacing'])
    expect(core.checks.map((c) => c.id)).toEqual(['coverage', 'geometry', 'mapping', 'metadata', 'file'])
  })

  it('the exported-file checks are not a plan decision: they run whenever a file is checked', () => {
    const face = createTypeface('t', 'geometric')
    const r = runQualityChecks(face, { issues: [{ severity: 'error', code: 'x.bad', message: 'broken', source: 'binary' }], format: 'TrueType' }, { extended: false })
    expect(r.fileChecked).toBe(true)
    expect(r.findings.some((f) => f.id === 'x.bad' && f.severity === 'blocking')).toBe(true)
  })
})
