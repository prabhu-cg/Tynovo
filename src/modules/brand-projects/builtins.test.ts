import { describe, expect, it } from 'vitest'
import { createSampleProject, SAMPLE_PROJECT_ID } from '@/modules/brand-system/sample'
import { MemoryProjectRepository } from '@/modules/persistence/repositories'
import { fakeClock } from '@/modules/testing/factories'
import { serializeProject } from './model'
import { parseProject } from './migrations'
import { ReadOnlyError, ProjectService } from './service'

const make = () => {
  const repo = new MemoryProjectRepository()
  return { repo, service: new ProjectService(repo, fakeClock(), [createSampleProject()]) }
}

describe('built-in (sample) projects', () => {
  it('can be opened and read like any project, without being stored', async () => {
    const { repo, service } = make()
    expect(service.isReadOnly(SAMPLE_PROJECT_ID)).toBe(true)
    expect(service.isReadOnly('anything-else')).toBe(false)
    const opened = await service.open(SAMPLE_PROJECT_ID)
    expect(opened!.project.name).toBe('Fieldnote sample')
    expect(opened!.migratedFrom).toBeNull()
    expect((await service.get(SAMPLE_PROJECT_ID))!.id).toBe(SAMPLE_PROJECT_ID)
    expect(await repo.get(SAMPLE_PROJECT_ID)).toBeNull() // never written to storage
  })

  it('never appears in the list of a person\'s own projects', async () => {
    const { service } = make()
    await service.create('Mine')
    expect((await service.list()).projects.map((p) => p.name)).toEqual(['Mine'])
    expect(service.builtInProjects().map((p) => p.id)).toEqual([SAMPLE_PROJECT_ID])
  })

  it('refuses to save, rename or delete, with a plain explanation, and changes nothing', async () => {
    const { repo, service } = make()
    const sample = (await service.get(SAMPLE_PROJECT_ID))!
    const edited = { ...sample, name: 'Hacked' }
    await expect(service.save(edited, sample.updatedAt)).rejects.toBeInstanceOf(ReadOnlyError)
    await expect(service.rename(SAMPLE_PROJECT_ID, 'Hacked')).rejects.toThrow(/read-only sample/)
    await expect(service.delete(SAMPLE_PROJECT_ID)).rejects.toThrow(/read-only sample/)
    expect((await service.get(SAMPLE_PROJECT_ID))!.name).toBe('Fieldnote sample')
    expect((await repo.list()).projects).toEqual([])
  })

  it('hands out copies, so changing what was returned never changes the sample', async () => {
    const { service } = make()
    const a = (await service.get(SAMPLE_PROJECT_ID))!
    a.brand.name = 'Changed in memory'
    a.typography.roles.length = 0
    service.builtInProjects()[0]!.name = 'Also changed'
    const b = (await service.open(SAMPLE_PROJECT_ID))!.project
    expect(b.brand.name).toBe('Fieldnote')
    expect(b.typography.roles).toHaveLength(5)
    expect(b.name).toBe('Fieldnote sample')
  })

  it('can be duplicated into an ordinary project that is fully editable, with its own ids and no export history', async () => {
    const { repo, service } = make()
    const copy = await service.duplicate(SAMPLE_PROJECT_ID)
    expect(copy.id).not.toBe(SAMPLE_PROJECT_ID)
    expect(service.isReadOnly(copy.id)).toBe(false)
    expect(copy.name).toBe('Fieldnote sample (copy)')
    expect(copy.exportHistory).toEqual([])
    expect(copy.customTypeface!.familyName).toBe('Fieldnote Rounded')
    expect(parseProject(await repo.get(copy.id)).ok).toBe(true)
    const saved = await service.save({ ...copy, brand: { ...copy.brand, name: 'Mine now' } }, copy.updatedAt)
    expect(saved.brand.name).toBe('Mine now')
    expect((await service.get(SAMPLE_PROJECT_ID))!.brand.name).toBe('Fieldnote') // the sample is untouched
    // Another copy is independent of the first.
    const second = await service.duplicate(SAMPLE_PROJECT_ID)
    expect(second.brand.name).toBe('Fieldnote')
  })

  it('can be exported, and importing that file makes a copy rather than a second sample', async () => {
    const { service } = make()
    const file = serializeProject((await service.get(SAMPLE_PROJECT_ID))!, fakeClock())
    const { project, renamedOnClash } = await service.importFile(file)
    expect(renamedOnClash).toBe(true)
    expect(project.id).not.toBe(SAMPLE_PROJECT_ID)
    expect(project.name).toBe('Fieldnote sample (imported)')
    expect(service.isReadOnly(project.id)).toBe(false)
  })
})
