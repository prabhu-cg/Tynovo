import { fakeClock } from '@/modules/testing/factories'
import { parseProject } from './migrations'
import { createProject, duplicateProject, parseProjectFile, prepareImport, projectFilename, renameProject, serializeProject } from './model'
import { CURRENT_SCHEMA_VERSION } from './schema'

describe('createProject', () => {
  it('creates a valid project with default roles and scale', () => {
    const p = createProject('  Acme  ', fakeClock())
    expect(p.name).toBe('Acme')
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(p.typography.roles.map((r) => r.name)).toEqual(['Display', 'Heading', 'Body', 'UI', 'Caption'])
    expect(parseProject(p).ok).toBe(true)
  })
  it('falls back to a placeholder name', () => {
    expect(createProject('   ', fakeClock()).name).toBe('Untitled project')
  })
})

describe('duplicate / rename', () => {
  it('duplicates with new id, copy name and independent data', () => {
    const clock = fakeClock()
    const a = createProject('A', clock)
    const b = duplicateProject(a, clock)
    expect(b.id).not.toBe(a.id)
    expect(b.name).toBe('A (copy)')
    b.brand.personality.push('bold')
    expect(a.brand.personality).toEqual([])
  })
  it('renames and bumps updatedAt, rejecting empty names', () => {
    const clock = fakeClock()
    const a = createProject('A', clock)
    const r = renameProject(a, ' B ', clock)
    expect(r.name).toBe('B')
    expect(r.updatedAt > a.updatedAt).toBe(true)
    expect(() => renameProject(a, '  ', clock)).toThrow()
  })
})

describe('project files', () => {
  it('round-trips through serialize/parse', () => {
    const p = createProject('Round Trip', fakeClock())
    const parsed = parseProjectFile(serializeProject(p, fakeClock()))
    expect(parsed.ok && parsed.project).toEqual(p)
  })
  it.each([
    ['not json', 'nope'],
    ['wrong format', JSON.stringify({ format: 'other', project: {} })],
    ['bad project', JSON.stringify({ format: 'brand-typography-studio.project', project: { schemaVersion: 1 } })],
  ])('rejects %s', (_label, text) => {
    expect(parseProjectFile(text).ok).toBe(false)
  })
  it('re-identifies an imported project on id clash instead of replacing', () => {
    const clock = fakeClock()
    const p = createProject('X', clock)
    const out = prepareImport(p, new Set([p.id]), clock)
    expect(out.id).not.toBe(p.id)
    expect(out.name).toBe('X (imported)')
    expect(prepareImport(p, new Set(), clock)).toBe(p)
  })
  it('makes safe filenames', () => {
    expect(projectFilename(createProject('Héllo / Wörld!', fakeClock()))).toBe('h-llo-w-rld.tynovo.json')
  })
})
