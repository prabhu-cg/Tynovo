import { act, renderHook, waitFor } from '@testing-library/react'
import { ProjectService } from '@/modules/brand-projects/service'
import { MemoryProjectRepository } from '@/modules/persistence/repositories'
import { StorageError, type ProjectRepository, type SaveOptions } from '@/modules/persistence/types'
import type { Project } from '@/modules/brand-projects/schema'
import { fakeClock } from '@/modules/testing/factories'
import { useProjectEditor } from './useProjectEditor'

async function setup(repo: ProjectRepository = new MemoryProjectRepository()) {
  const service = new ProjectService(repo, fakeClock())
  const project = await service.create('Alpha')
  const hook = renderHook(() => useProjectEditor(service, project.id, 20))
  await waitFor(() => expect(hook.result.current.load).toBe('ready'))
  return { service, project, hook, repo }
}

const rename = (name: string) => (p: Project) => ({ ...p, name })

describe('useProjectEditor', () => {
  it('loads, then autosaves after the pause', async () => {
    const { service, project, hook } = await setup()
    act(() => hook.result.current.patch(rename('Beta')))
    expect(hook.result.current.state).toBe('dirty')
    await waitFor(() => expect(hook.result.current.state).toBe('saved'))
    expect((await service.get(project.id))?.name).toBe('Beta')
    expect(hook.result.current.lastSavedAt).toBeInstanceOf(Date)
  })

  it('reports missing projects', async () => {
    const service = new ProjectService(new MemoryProjectRepository(), fakeClock())
    const { result } = renderHook(() => useProjectEditor(service, 'nope', 20))
    await waitFor(() => expect(result.current.load).toBe('missing'))
  })

  it('keeps the draft and reports an error when storage fails, then recovers on flush', async () => {
    const repo = new MemoryProjectRepository()
    let fail = false
    const flaky: ProjectRepository = {
      kind: repo.kind,
      list: () => repo.list(),
      get: (id) => repo.get(id),
      getRaw: (id) => repo.getRaw(id),
      delete: (id) => repo.delete(id),
      save: (p: Project, o: SaveOptions) => (fail ? Promise.reject(new StorageError('quota', 'Browser storage is full.')) : repo.save(p, o)),
    }
    const { hook, service, project } = await setup(flaky)
    fail = true
    act(() => hook.result.current.patch(rename('Edited')))
    await waitFor(() => expect(hook.result.current.state).toBe('error'))
    expect(hook.result.current.error).toMatch(/storage is full/)
    expect(hook.result.current.draft?.name).toBe('Edited') // edits are not lost
    expect((await service.get(project.id))?.name).toBe('Alpha')

    fail = false
    let ok = false
    await act(async () => void (ok = await hook.result.current.flush()))
    expect(ok).toBe(true)
    expect(hook.result.current.state).toBe('saved')
    expect((await service.get(project.id))?.name).toBe('Edited')
  })

  it('stops with a conflict instead of overwriting a newer version', async () => {
    const { hook, service, project } = await setup()
    const other = (await service.get(project.id))!
    await service.save({ ...other, name: 'From another tab' }, other.updatedAt)
    act(() => hook.result.current.patch(rename('Mine')))
    await waitFor(() => expect(hook.result.current.state).toBe('conflict'))
    expect((await service.get(project.id))?.name).toBe('From another tab')
    await act(() => hook.result.current.reload())
    expect(hook.result.current.draft?.name).toBe('From another tab')
    expect(hook.result.current.state).toBe('saved')
  })

  it('does not drop edits made while a save is in flight', async () => {
    const repo = new MemoryProjectRepository()
    let release: () => void = () => {}
    let gate: Promise<void> | null = null
    const slow: ProjectRepository = {
      kind: repo.kind,
      list: () => repo.list(),
      get: (id) => repo.get(id),
      getRaw: (id) => repo.getRaw(id),
      delete: (id) => repo.delete(id),
      save: async (p, o) => {
        if (gate) await gate
        return repo.save(p, o)
      },
    }
    const { hook, service, project } = await setup(slow)
    gate = new Promise<void>((r) => (release = r))
    act(() => hook.result.current.patch(rename('One')))
    await waitFor(() => expect(hook.result.current.state).toBe('saving'))
    act(() => hook.result.current.patch(rename('Two'))) // typed during the save
    gate = null
    release()
    await waitFor(() => expect(hook.result.current.state).toBe('saved'))
    expect((await service.get(project.id))?.name).toBe('Two')
  })

  it('refuses to save an empty name', async () => {
    const { hook, service, project } = await setup()
    act(() => hook.result.current.patch(rename('   ')))
    await waitFor(() => expect(hook.result.current.state).toBe('invalid'))
    expect((await service.get(project.id))?.name).toBe('Alpha')
    act(() => hook.result.current.patch(rename('Fixed')))
    await waitFor(() => expect(hook.result.current.state).toBe('saved'))
  })

  it('flush saves immediately without waiting for the pause', async () => {
    const { hook, service, project } = await setup()
    const slowHook = renderHook(() => useProjectEditor(service, project.id, 60_000))
    await waitFor(() => expect(slowHook.result.current.load).toBe('ready'))
    act(() => slowHook.result.current.patch(rename('Now')))
    await act(async () => void (await slowHook.result.current.flush()))
    expect((await service.get(project.id))?.name).toBe('Now')
    hook.unmount()
  })
})
