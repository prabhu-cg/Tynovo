import { fakeClock } from '@/modules/testing/factories'
import { MIGRATIONS, parseProject } from './migrations'
import { createProject } from './model'
import { CURRENT_SCHEMA_VERSION } from './schema'

/** What a v2 project looked like on disk: roles with fontSourceId, sources that could be 'generated'. */
function v2() {
  const p = createProject('Old', fakeClock()) as unknown as Record<string, any>
  p['schemaVersion'] = 2
  p['typography'] = {
    scale: p['typography'].scale,
    roles: [
      { id: 'r1', name: 'Display', fontSourceId: null, weight: 700, scaleStep: 6, lineHeight: 1.05, letterSpacingEm: -0.02 },
      { id: 'r2', name: 'Heading', fontSourceId: 's1', weight: 600, scaleStep: 3, lineHeight: 1.2, letterSpacingEm: 0 },
      { id: 'r3', name: 'Body copy', fontSourceId: 'g1', weight: 400, scaleStep: 0, lineHeight: 1.5, letterSpacingEm: 0 },
      { id: 'r4', name: 'Caption', fontSourceId: null, weight: 400, scaleStep: -1, lineHeight: 1.4, letterSpacingEm: 0 },
      { id: 'r5', name: 'Pull quote', fontSourceId: null, weight: 400, scaleStep: 4, lineHeight: 1.3, letterSpacingEm: 0 },
    ],
  }
  p['fontSources'] = [
    { id: 's1', family: 'Manrope', kind: 'catalog', license: { name: 'OFL', verified: true }, weights: [400] },
    { id: 'g1', family: 'Generated', kind: 'generated', license: { name: 'x', verified: false }, weights: [] },
  ]
  return p
}

describe('v2 → v3 migration', () => {
  it('has a step registered for every version up to the current one', () => {
    for (let v = 1; v < CURRENT_SCHEMA_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf('function')
  })

  it('turns fontSourceId into a typed font link and infers a kind for each role', () => {
    const r = parseProject(v2())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.migratedFrom).toBe(2)
    const roles = r.project.typography.roles
    expect(roles.map((x) => x.kind)).toEqual(['display', 'heading', 'body', 'caption', 'display', 'ui']) // "Pull quote" has no telling name (step 4 is large); the caption was an interface role in v3, and v4 adds the missing UI role
    expect(roles[1]!.font).toEqual({ kind: 'source', sourceId: 's1' })
    expect(roles[0]!.font).toBeNull()
    expect('fontSourceId' in roles[0]!).toBe(false)
  })

  it('drops the never-used generated source and gives font sources a fallback', () => {
    const r = parseProject(v2())
    if (!r.ok) throw new Error(r.message)
    expect(r.project.fontSources.map((s) => s.id)).toEqual(['s1'])
    expect(r.project.fontSources[0]!.fallback).toBe('sans-serif')
    expect(r.project.typography.roles[2]!.font).toBeNull() // pointed at the generated source; there is no typeface to link to
  })

  it('links a role that used the generated source to the project typeface when there is one', () => {
    const raw = v2()
    raw['customTypeface'] = {
      id: 'face-9', familyName: 'Old Face', styleName: 'Regular', engineVersion: 1,
      dna: { family: 'geometric', capHeight: 700, xHeightRatio: 0.72, ascenderRise: 30, descenderDepth: 200, widthScale: 1, strokeThickness: 100, contrast: 1, roundness: 1, overshoot: 12, crossbarPosition: 0.5, grid: 0, cornerStyle: 'sharp', cornerRadius: 0, innerCornerRatio: 0, terminal: 'flat', aperture: 0.32, sidebearing: 60, sidebearingBalance: 0, tracking: 0, spaceWidth: 280 },
      overrides: {}, kerning: [], variants: [], history: [], license: { name: 'x', verified: false }, copyright: '',
    }
    const r = parseProject(raw)
    if (!r.ok) throw new Error(r.message)
    expect(r.project.typography.roles[2]!.font).toEqual({ kind: 'custom', typefaceId: 'face-9' })
  })

  it('does not change the input', () => {
    const raw = v2()
    const before = JSON.stringify(raw)
    parseProject(raw)
    expect(JSON.stringify(raw)).toBe(before)
  })

  it('chains from v1 all the way to the current version', () => {
    const raw = { ...v2(), schemaVersion: 1, customTypeface: null }
    const r = parseProject(raw)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })
})
