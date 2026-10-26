import { MemoryProjectRepository } from '@/modules/persistence/repositories'
import { fakeClock, integratedProject } from '@/modules/testing/factories'
import { parseProject } from './migrations'
import { CURRENT_SCHEMA_VERSION } from './schema'
import { serializeProject } from './model'
import { recoverProject } from './recover'
import { ImportError, ProjectService } from './service'

const damaged = () => {
  const p = structuredClone(integratedProject()) as unknown as Record<string, any>
  p['typography'].roles[1].weight = 'bold' // unreadable role
  p['typography'].roles[0].lineHeight = 99 // out of range
  p['customTypeface'].kerning = [{ left: 'A', right: 'V', value: -20 }, { left: 'A' }]
  p['customTypeface'].overrides = { H: { advanceWidth: 700 }, O: { advanceWidth: -5 } }
  p['exportHistory'] = [{ nonsense: true }]
  return p
}

describe('recoverProject', () => {
  it('keeps what is readable, drops what is not, and lists every loss', () => {
    const r = recoverProject(damaged(), fakeClock())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const { project, losses } = r.recovery
    expect(project.typography.roles.map((x) => x.name)).toEqual(['Body', 'UI', 'Caption'])
    expect(project.customTypeface!.kerning).toEqual([{ left: 'A', right: 'V', value: -20 }])
    expect(Object.keys(project.customTypeface!.overrides)).toEqual(['H'])
    expect(project.brand.personality).toEqual(['precise', 'warm'])
    expect(losses.join(' ')).toMatch(/2 typography roles/)
    expect(losses.join(' ')).toMatch(/1 kerning pair, 1 glyph override|1 glyph override, 1 kerning pair/)
    expect(losses.join(' ')).toMatch(/1 export history entry/)
    expect(parseProject(project).ok).toBe(true)
  })

  it('never reuses the id, so the damaged record is not overwritten', () => {
    const raw = damaged()
    const r = recoverProject(raw, fakeClock())
    if (!r.ok) throw new Error(r.message)
    expect(r.recovery.project.id).not.toBe(raw['id'])
    expect(r.recovery.project.name).toMatch(/\(recovered\)$/)
  })

  it('unlinks roles whose font was lost, instead of leaving dead links', () => {
    const raw = damaged()
    raw['customTypeface'].dna = { family: 'nonsense' }
    const r = recoverProject(raw, fakeClock())
    if (!r.ok) throw new Error(r.message)
    expect(r.recovery.project.customTypeface).toBeNull()
    expect(r.recovery.losses.join(' ')).toMatch(/typeface was dropped/)
    for (const role of r.recovery.project.typography.roles) expect(role.font?.kind).not.toBe('custom')
  })

  it('upgrades an old record first, then salvages it', () => {
    const raw = { id: 'old', schemaVersion: 2, name: 'Old', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: 'not a date', brand: { personality: ['a'], notes: 5 }, typography: { scale: { baseSizePx: 16, ratio: 1.25, stepsDown: 2, stepsUp: 6 }, roles: [] }, fontSources: [], customTypeface: null, exportHistory: [] }
    const r = recoverProject(raw, fakeClock())
    if (!r.ok) throw new Error(r.message)
    expect(r.recovery.project.brand.personality).toEqual(['a'])
    expect(r.recovery.project.typography.roles).toHaveLength(5)
    expect(r.recovery.losses.length).toBeGreaterThan(0)
  })

  it('refuses what cannot be a project at all', () => {
    expect(recoverProject('text')).toMatchObject({ ok: false })
    expect(recoverProject({ schemaVersion: 99 })).toMatchObject({ ok: false })
    expect(recoverProject({ name: 'no version' })).toMatchObject({ ok: false })
  })
})

describe('ProjectService: opening, importing and recovering', () => {
  it('reports an upgrade on open and keeps the stored record untouched until a save', async () => {
    const repo = new MemoryProjectRepository()
    const service = new ProjectService(repo, fakeClock())
    const v2 = structuredClone(integratedProject()) as unknown as Record<string, any>
    v2['schemaVersion'] = 2
    v2['id'] = 'old-1'
    v2['typography'].roles = v2['typography'].roles.map(({ kind: _k, font: _f, ...r }: Record<string, unknown>) => ({ ...r, fontSourceId: null }))
    v2['fontSources'] = v2['fontSources'].map(({ fallback: _fb, ...s }: Record<string, unknown>) => s)
    // plant it behind the repository's back, like an old IndexedDB row
    ;(repo as unknown as { rows: Map<string, unknown> }).rows.set('old-1', v2)
    const opened = await service.open('old-1')
    expect(opened!.migratedFrom).toBe(2)
    expect(JSON.parse(opened!.originalJson!).schemaVersion).toBe(2)
    expect(((await repo.getRaw('old-1')) as { schemaVersion: number }).schemaVersion).toBe(2)
    await service.save(opened!.project, opened!.project.updatedAt)
    expect(((await repo.getRaw('old-1')) as { schemaVersion: number }).schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect((await service.open('old-1'))!.migratedFrom).toBeNull()
    expect(await service.open('nope')).toBeNull()
  })

  it('offers recovery for a project file that fails validation, and stores the result as a new project', async () => {
    const repo = new MemoryProjectRepository()
    const service = new ProjectService(repo, fakeClock())
    const file = serializeProject(damaged() as never, fakeClock())
    const err = await service.importFile(file).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ImportError)
    expect((err as ImportError).recoverable).toBe(true)
    const rec = await service.recoverFile(file)
    expect((await service.list()).projects.map((p) => p.id)).toEqual([rec.project.id])
  })

  it('does not call plain garbage recoverable', async () => {
    const service = new ProjectService(new MemoryProjectRepository(), fakeClock())
    expect(await service.importFile('{"hello":1}').catch((e: ImportError) => e.recoverable)).toBe(false)
    expect(await service.importFile('nope').catch((e: ImportError) => e.recoverable)).toBe(false)
  })

  it('recovers a stored record into a new project and leaves the damaged one in place', async () => {
    const repo = new MemoryProjectRepository()
    const service = new ProjectService(repo, fakeClock())
    ;(repo as unknown as { rows: Map<string, unknown> }).rows.set('bad', { ...damaged(), id: 'bad' })
    expect((await service.list()).unreadable.map((u) => u.id)).toEqual(['bad'])
    const rec = await service.recoverRecord('bad')
    const listing = await service.list()
    expect(listing.unreadable.map((u) => u.id)).toEqual(['bad'])
    expect(listing.projects.map((p) => p.id)).toEqual([rec.project.id])
    await expect(service.recoverRecord('missing')).rejects.toThrow(/no longer exists/)
  })

  it('deleting or duplicating one project never changes another', async () => {
    const repo = new MemoryProjectRepository()
    const service = new ProjectService(repo, fakeClock())
    const a = await service.create('A')
    const base = { ...integratedProject('B'), id: 'project-b' }
    await repo.save(base, { expectedUpdatedAt: null })
    const before = JSON.stringify(await service.get(base.id))
    const copy = await service.duplicate(base.id)
    expect(copy.id).not.toBe(base.id)
    // editing the copy's typeface and roles must not reach the original
    const edited = { ...copy, customTypeface: { ...copy.customTypeface!, familyName: 'Changed' }, typography: { ...copy.typography, roles: copy.typography.roles.map((r) => ({ ...r, weight: 300 })) } }
    await service.save(edited, copy.updatedAt)
    expect(JSON.stringify(await service.get(base.id))).toBe(before)
    await service.delete(copy.id)
    expect(JSON.stringify(await service.get(base.id))).toBe(before)
    expect((await service.get(a.id))!.name).toBe('A')
    await service.delete(base.id)
    expect((await service.get(a.id))!.name).toBe('A')
  })
})
