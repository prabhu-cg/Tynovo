import { deleteDB } from 'idb'
import { ProjectService } from '@/modules/brand-projects/service'
import { createProject } from '@/modules/brand-projects/model'
import { fakeClock } from '@/modules/testing/factories'
import { IndexedDbProjectRepository, MemoryProjectRepository } from './repositories'
import { StorageError, type ProjectRepository } from './types'

async function freshIdb() {
  const name = `test-${Math.random()}`
  const repo = await IndexedDbProjectRepository.open(name)
  return { repo, cleanup: async () => { repo.close(); await deleteDB(name) } }
}

describe.each([
  ['indexeddb', async () => freshIdb()],
  ['memory', async () => ({ repo: new MemoryProjectRepository() as ProjectRepository, cleanup: async () => {} })],
])('%s repository', (_name, make) => {
  let repo: ProjectRepository
  let cleanup: () => Promise<void>
  beforeEach(async () => ({ repo, cleanup } = await make()))
  afterEach(async () => cleanup())

  it('creates, lists, reopens and deletes projects', async () => {
    const svc = new ProjectService(repo, fakeClock())
    const a = await svc.create('Alpha')
    const b = await svc.create('Beta')
    const { projects } = await svc.list()
    expect(projects.map((p) => p.name)).toEqual(['Beta', 'Alpha']) // newest first
    expect(await svc.get(a.id)).toEqual(a)
    await svc.delete(b.id)
    expect((await svc.list()).projects.map((p) => p.id)).toEqual([a.id])
    expect(await svc.get(b.id)).toBeNull()
  })

  it('duplicates and renames without touching the original', async () => {
    const svc = new ProjectService(repo, fakeClock())
    const a = await svc.create('Alpha')
    const copy = await svc.duplicate(a.id)
    expect(copy.name).toBe('Alpha (copy)')
    await svc.rename(copy.id, 'Gamma')
    expect((await svc.get(a.id))?.name).toBe('Alpha')
    expect((await svc.get(copy.id))?.name).toBe('Gamma')
  })

  it('refuses to overwrite a project that changed since it was loaded', async () => {
    const svc = new ProjectService(repo, fakeClock())
    const a = await svc.create('Alpha')
    const tabA = (await svc.get(a.id))!
    const tabB = (await svc.get(a.id))!
    await svc.save({ ...tabA, name: 'From tab A' }, tabA.updatedAt)
    await expect(svc.save({ ...tabB, name: 'From tab B' }, tabB.updatedAt)).rejects.toMatchObject({ code: 'conflict' })
    expect((await svc.get(a.id))?.name).toBe('From tab A')
  })

  it('refuses to create over an existing id and to save a deleted project', async () => {
    const p = createProject('Dup', fakeClock())
    await repo.save(p, { expectedUpdatedAt: null })
    await expect(repo.save(p, { expectedUpdatedAt: null })).rejects.toMatchObject({ code: 'conflict' })
    await repo.delete(p.id)
    await expect(repo.save(p, { expectedUpdatedAt: p.updatedAt })).rejects.toMatchObject({ code: 'conflict' })
  })

  it('imports a project file as a copy when its id already exists', async () => {
    const svc = new ProjectService(repo, fakeClock())
    const a = await svc.create('Alpha')
    const { serializeProject } = await import('@/modules/brand-projects/model')
    const res = await svc.importFile(serializeProject(a))
    expect(res.renamedOnClash).toBe(true)
    expect((await svc.list()).projects).toHaveLength(2)
    expect((await svc.get(a.id))?.name).toBe('Alpha')
  })

  it('rejects an invalid import file without storing anything', async () => {
    const svc = new ProjectService(repo, fakeClock())
    await expect(svc.importFile('{"format":"x"}')).rejects.toThrow()
    expect((await svc.list()).projects).toHaveLength(0)
  })
})

describe('corrupt data', () => {
  it('lists unreadable records separately and keeps them', async () => {
    const name = `test-${Math.random()}`
    const { openDB } = await import('idb')
    const raw = await openDB(name, 1, { upgrade: (d) => void d.createObjectStore('projects', { keyPath: 'id' }) })
    await raw.put('projects', { id: 'bad', schemaVersion: 1, name: '' })
    await raw.put('projects', { id: 'future', schemaVersion: 99 })
    raw.close()
    const repo = await IndexedDbProjectRepository.open(name)
    const svc = new ProjectService(repo, fakeClock())
    await svc.create('Good')
    const { projects, unreadable } = await svc.list()
    expect(projects.map((p) => p.name)).toEqual(['Good'])
    expect(unreadable.map((u) => u.id).sort()).toEqual(['bad', 'future'])
    expect(unreadable.find((u) => u.id === 'future')?.reason).toMatch(/newer version/)
    expect(await repo.get('future').catch((e) => e)).toBeInstanceOf(StorageError)
    repo.close()
    await deleteDB(name)
  })
})
