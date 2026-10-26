import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProjectService } from '@/modules/brand-projects/service'
import { createSampleProject, SAMPLE_PROJECT_ID } from '@/modules/brand-system/sample'
import { updateRole } from '@/modules/brand-system/ops'
import { MemoryProjectRepository } from '@/modules/persistence/repositories'
import { fakeClock } from '@/modules/testing/factories'
import { useProjectEditor } from './useProjectEditor'

describe('useProjectEditor on a read-only project', () => {
  const setup = async () => {
    const repo = new MemoryProjectRepository()
    const service = new ProjectService(repo, fakeClock(), [createSampleProject()])
    const hook = renderHook(() => useProjectEditor(service, SAMPLE_PROJECT_ID, 20))
    await waitFor(() => expect(hook.result.current.load).toBe('ready'))
    return { repo, service, hook }
  }

  it('loads, reports read-only, and shows a saved state with nothing to save', async () => {
    const { hook } = await setup()
    expect(hook.result.current.readOnly).toBe(true)
    expect(hook.result.current.state).toBe('saved')
    expect(hook.result.current.draft!.name).toBe('Fieldnote sample')
  })

  it('refuses every edit, counts what was refused, and never stores anything', async () => {
    const { hook, repo } = await setup()
    const before = JSON.stringify(hook.result.current.draft)
    act(() => hook.result.current.patch((p) => ({ ...p, name: 'Changed' })))
    act(() => hook.result.current.patch((p) => updateRole(p, p.typography.roles[0]!.id, { weight: 900 })))
    expect(hook.result.current.rejected).toBe(2)
    expect(JSON.stringify(hook.result.current.draft)).toBe(before)
    expect(hook.result.current.state).toBe('saved')
    await new Promise((r) => setTimeout(r, 80)) // longer than the autosave pause
    expect((await repo.list()).projects).toEqual([])
    expect(await hook.result.current.flush()).toBe(true)
  })

  it('does not count an edit that would change nothing', async () => {
    const { hook } = await setup()
    act(() => hook.result.current.patch((p) => p))
    expect(hook.result.current.rejected).toBe(0)
  })

  it('an ordinary project is unaffected', async () => {
    const repo = new MemoryProjectRepository()
    const service = new ProjectService(repo, fakeClock(), [createSampleProject()])
    const mine = await service.create('Mine')
    const hook = renderHook(() => useProjectEditor(service, mine.id, 20))
    await waitFor(() => expect(hook.result.current.load).toBe('ready'))
    expect(hook.result.current.readOnly).toBe(false)
    act(() => hook.result.current.patch((p) => ({ ...p, name: 'Renamed' })))
    await waitFor(() => expect(hook.result.current.state).toBe('saved'))
    expect((await service.get(mine.id))!.name).toBe('Renamed')
  })
})
