import type { ZodType } from 'zod'
import { fakeClock } from '@/modules/testing/factories'
import { parseProject, type MigrationStep } from './migrations'
import { createProject } from './model'
import type { Project } from './schema'

const valid = () => createProject('P', fakeClock())

describe('parseProject', () => {
  it('accepts a current-version project without reporting migration', () => {
    const r = parseProject(valid())
    expect(r.ok && r.migratedFrom).toBe(null)
  })
  it('does not mutate its input', () => {
    const input = valid()
    const snapshot = structuredClone(input)
    parseProject(input)
    expect(input).toEqual(snapshot)
  })
  it.each([
    ['null', null, 'not-an-object'],
    ['array', [], 'not-an-object'],
    ['no version', { ...valid(), schemaVersion: undefined }, 'missing-version'],
    ['float version', { ...valid(), schemaVersion: 1.5 }, 'missing-version'],
    ['newer version', { ...valid(), schemaVersion: 99 }, 'newer-version'],
    ['bad field', { ...valid(), name: '' }, 'invalid'],
    ['bad nested field', { ...valid(), typography: { ...valid().typography, scale: { baseSizePx: 1, ratio: 1.2, stepsDown: 0, stepsUp: 0 } } }, 'invalid'],
  ])('rejects %s', (_l, input, reason) => {
    const r = parseProject(input)
    expect(!r.ok && r.reason).toBe(reason)
  })

  describe('migration chain', () => {
    // Simulate a future v3 schema: v1 -> v2 renames `title` to `name`, v2 -> v3 adds nothing structural.
    const passthroughSchema = { safeParse: (v: unknown) => ({ success: true, data: v as Project }) } as unknown as ZodType<Project>
    const migrations: Record<number, MigrationStep> = {
      1: (raw) => {
        const { title, ...rest } = raw
        return { ...rest, name: title }
      },
      2: (raw) => ({ ...raw, extra: true }),
    }
    it('applies steps in order and stamps the version', () => {
      const r = parseProject({ schemaVersion: 1, title: 'Old' }, { migrations, target: 3, schema: passthroughSchema })
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.project).toMatchObject({ schemaVersion: 3, name: 'Old', extra: true })
        expect(r.migratedFrom).toBe(1)
      }
    })
    it('fails clearly when a step is missing', () => {
      const r = parseProject({ schemaVersion: 1 }, { migrations: { 2: (x) => x }, target: 3, schema: passthroughSchema })
      expect(!r.ok && r.reason).toBe('no-migration')
    })
  })
})

describe('v1 → v2 migration (Phase-0 proof typeface to design DNA)', () => {
  const legacyTypeface = {
    id: 'face-1',
    familyName: 'Proof Sans',
    styleName: 'Regular',
    params: { stem: 150, width: 800, radius: 350 },
    metrics: { unitsPerEm: 1000, ascender: 800, descender: -200, lineGap: 0, capHeight: 700, xHeight: 500 },
    spacing: { defaultSidebearing: 70, trackingUnits: 0 },
    glyphs: { A: { char: 'A', name: 'A', advanceWidth: 760, contours: [] } },
    overrides: { H: { advanceWidth: 700, locked: true }, O: { contours: [[{ x: 0, y: 0, onCurve: true }, { x: 0, y: 10, onCurve: true }, { x: 10, y: 10, onCurve: true }]] } },
    kerning: [{ left: 'A', right: 'T', value: -60 }],
    license: { name: 'OFL-1.1', verified: true },
    copyright: 'Copyright 2026 Example',
  }
  const v1 = (typeface: unknown) => {
    const p = valid()
    return { ...p, schemaVersion: 1, customTypeface: typeface }
  }

  it('upgrades a project without a typeface unchanged apart from the version', () => {
    const r = parseProject(v1(null))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.migratedFrom).toBe(1)
      expect(r.project.schemaVersion).toBe(2)
      expect(r.project.customTypeface).toBeNull()
    }
  })

  it('maps the three legacy numbers onto the DNA and keeps the user data', () => {
    const r = parseProject(v1(legacyTypeface))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const t = r.project.customTypeface!
    expect(t).toMatchObject({ id: 'face-1', familyName: 'Proof Sans', styleName: 'Regular', engineVersion: 1, copyright: 'Copyright 2026 Example', variants: [], history: [] })
    expect(t.dna).toMatchObject({ family: 'geometric', strokeThickness: 150, widthScale: 1.29, roundness: 1 })
    expect(t.license).toEqual({ name: 'OFL-1.1', verified: true })
    expect(t.kerning).toEqual([{ left: 'A', right: 'T', value: -60 }])
    // Overrides survive, except legacy fields that no longer exist.
    expect(t.overrides['H']).toEqual({ advanceWidth: 700 })
    expect(t.overrides['O']!.contours).toHaveLength(1)
    // Generated glyphs are derived data and are not carried over.
    expect('glyphs' in t).toBe(false)
  })

  it('clamps out-of-range legacy numbers instead of failing', () => {
    const r = parseProject(v1({ ...legacyTypeface, params: { stem: 5000, width: 1, radius: -40 } }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.project.customTypeface!.dna).toMatchObject({ strokeThickness: 200, widthScale: 0.6, roundness: 0 })
  })

  it('a migrated project generates a valid typeface', async () => {
    const r = parseProject(v1(legacyTypeface))
    if (!r.ok) throw new Error(r.message)
    const { analyzeTypeface } = await import('@/modules/font-validation/coverage')
    const a = analyzeTypeface(r.project.customTypeface!)
    expect(a.supportedCount).toBeGreaterThan(80)
  })

  it('still refuses a v3 project and a v1 project with a broken typeface', () => {
    expect(parseProject({ ...valid(), schemaVersion: 3 })).toMatchObject({ ok: false, reason: 'newer-version' })
    expect(parseProject(v1({ id: 'x' }))).toMatchObject({ ok: false, reason: 'invalid' })
  })
})
