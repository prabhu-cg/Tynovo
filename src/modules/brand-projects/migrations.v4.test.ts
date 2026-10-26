import { describe, expect, it } from 'vitest'
import { fakeClock, integratedProject } from '@/modules/testing/factories'
import { parseProject } from './migrations'
import { CURRENT_SCHEMA_VERSION } from './schema'

/** A v3 project as stored: no brand direction, no sizes/responsive/pairing, a 'ui' caption, no fallback families. */
function v3() {
  const p = structuredClone(integratedProject('Old three', fakeClock())) as unknown as Record<string, any>
  p['schemaVersion'] = 3
  p['brand'] = { personality: ['calm'], notes: 'kept' }
  p['typography'] = {
    scale: p['typography'].scale,
    roles: [
      { id: 'r1', name: 'Display', kind: 'display', font: null, weight: 700, scaleStep: 6, lineHeight: 1.05, letterSpacingEm: 0 },
      { id: 'r3', name: 'Body', kind: 'body', font: { kind: 'source', sourceId: 's1' }, weight: 400, scaleStep: 0, lineHeight: 1.5, letterSpacingEm: 0 },
      { id: 'r4', name: 'Caption', kind: 'ui', font: null, weight: 400, scaleStep: -1, lineHeight: 1.4, letterSpacingEm: 0 },
    ],
  }
  p['fontSources'] = [{ id: 's1', family: 'Manrope', kind: 'catalog', license: { name: 'SIL Open Font License 1.1', verified: true }, weights: [400], fallback: 'sans-serif' }]
  p['customTypeface'] = null
  return p
}

describe('v3 → v4 migration (brand typography system)', () => {
  it('keeps the brand and gives it direction fields with neutral defaults', () => {
    const r = parseProject(v3())
    if (!r.ok) throw new Error(r.message)
    expect(r.migratedFrom).toBe(3)
    expect(r.project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(r.project.brand).toEqual({ name: '', description: '', personality: ['calm'], useCases: [], tones: [], readabilityPriority: 3, displayPriority: 3, notes: 'kept', sampleCopy: {} })
  })

  it('adds sizes, responsive (off), pairing (empty) and a custom fallback without touching the scale', () => {
    const raw = v3()
    const r = parseProject(raw)
    if (!r.ok) throw new Error(r.message)
    const t = r.project.typography
    expect(t.scale).toEqual(raw['typography'].scale)
    expect(t.sizes).toEqual({ headings: [5, 4, 3, 2, 1, 0], bodyLarge: 1, bodySmall: -1 })
    expect(t.responsive.enabled).toBe(false)
    expect(t.pairing).toEqual({ primary: null, secondary: null })
    expect(t.customFallback).toEqual({ families: [], generic: 'sans-serif' })
    expect(r.project.fontSources[0]!.fallbackFamilies).toEqual([])
  })

  it('turns a caption that was an interface role into a caption, and adds the UI role it leaves missing', () => {
    const r = parseProject(v3())
    if (!r.ok) throw new Error(r.message)
    expect(r.project.typography.roles.map((x) => [x.name, x.kind])).toEqual([['Display', 'display'], ['Body', 'body'], ['Caption', 'caption'], ['UI', 'ui']])
    expect(r.project.typography.roles.find((x) => x.name === 'Body')!.font).toEqual({ kind: 'source', sourceId: 's1' }) // links survive
  })

  it('does not add a UI role when one exists, and does not change the input', () => {
    const raw = v3()
    raw['typography'].roles.push({ id: 'r5', name: 'Buttons', kind: 'ui', font: null, weight: 600, scaleStep: 0, lineHeight: 1.2, letterSpacingEm: 0 })
    const before = JSON.stringify(raw)
    const r = parseProject(raw)
    if (!r.ok) throw new Error(r.message)
    expect(r.project.typography.roles.filter((x) => x.kind === 'ui').map((x) => x.name)).toEqual(['Buttons'])
    expect(JSON.stringify(raw)).toBe(before)
  })

  it('migrates a project with no role of its own gracefully', () => {
    const raw = v3()
    raw['typography'].roles = []
    expect(parseProject(raw).ok).toBe(true)
  })
})
