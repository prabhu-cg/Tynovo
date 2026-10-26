import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ProjectService } from '@/modules/brand-projects/service'
import { MemoryProjectRepository } from '@/modules/persistence/repositories'
import type { ProjectListing, ProjectRepository } from '@/modules/persistence/types'
import { fakeClock } from '@/modules/testing/factories'
import { DashboardPage } from './DashboardPage'
import { StudioCtx } from './studio'

function renderDashboard(repo: ProjectRepository = new MemoryProjectRepository(), kind: 'indexeddb' | 'memory' = 'indexeddb') {
  const service = new ProjectService(repo, fakeClock())
  render(
    <StudioCtx.Provider value={{ service, storageKind: kind, storageWarning: null }}>
      <MemoryRouter initialEntries={['/app/projects']}>
        <Routes>
          <Route path="/app/projects" element={<DashboardPage />} />
          <Route path="/app/projects/:id/*" element={<p>PROJECT PAGE</p>} />
        </Routes>
      </MemoryRouter>
    </StudioCtx.Provider>,
  )
  return service
}

describe('DashboardPage', () => {
  it('shows a loading skeleton, then the empty state', async () => {
    let release: (l: ProjectListing) => void = () => {}
    const repo = new MemoryProjectRepository()
    repo.list = () => new Promise<ProjectListing>((r) => (release = r))
    renderDashboard(repo)
    expect(screen.getByRole('list', { name: 'Loading projects' })).toBeInTheDocument()
    release({ projects: [], unreadable: [] })
    expect(await screen.findByRole('heading', { name: 'No projects yet' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Loading projects' })).not.toBeInTheDocument()
  })

  it('lists existing projects, newest first', async () => {
    const repo = new MemoryProjectRepository()
    const svc = new ProjectService(repo, fakeClock())
    await svc.create('Older')
    await svc.create('Newer')
    renderDashboard(repo)
    const links = await screen.findAllByRole('link', { name: /Older|Newer/ })
    expect(links.map((l) => l.textContent)).toEqual(['Newer', 'Older'])
  })

  it('creates a project from the drawer and opens the chosen section', async () => {
    const user = userEvent.setup()
    const service = renderDashboard()
    await user.click(await screen.findByRole('button', { name: 'Create your first project' }))
    const drawer = screen.getByRole('complementary', { name: 'New project' })
    await user.type(within(drawer).getByLabelText('Project name'), 'Brand X')
    await user.click(within(drawer).getByRole('radio', { name: /Custom Typeface Creator/ }))
    await user.click(within(drawer).getByRole('button', { name: 'Create project' }))
    expect(await screen.findByText('PROJECT PAGE')).toBeInTheDocument()
    const { projects } = await service.list()
    expect(projects.map((p) => p.name)).toEqual(['Brand X'])
  })

  it('names an unnamed project "Untitled project" and closes the drawer on Escape', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await user.click(await screen.findByRole('button', { name: 'New project' }))
    const drawer = screen.getByRole('complementary', { name: 'New project' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'New project' })).not.toBeInTheDocument())
    expect(drawer).not.toBeInTheDocument()
  })

  it('shows a recoverable error when projects cannot be loaded', async () => {
    const repo = new MemoryProjectRepository()
    repo.list = () => Promise.reject(new Error('disk on fire'))
    renderDashboard(repo)
    expect(await screen.findByRole('alert')).toHaveTextContent('disk on fire')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('warns when storage is memory-only', async () => {
    renderDashboard(new MemoryProjectRepository(), 'memory')
    expect(await screen.findByRole('alert')).toHaveTextContent('kept in memory')
  })

  it('renames inline, and confirms before deleting', async () => {
    const user = userEvent.setup()
    const repo = new MemoryProjectRepository()
    const svc = new ProjectService(repo, fakeClock())
    await svc.create('Rename me')
    renderDashboard(repo)
    await user.click(await screen.findByRole('button', { name: 'More actions for Rename me' }))
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const input = screen.getByLabelText('New name for Rename me')
    await user.clear(input)
    await user.type(input, 'Renamed{Enter}')
    expect(await screen.findByRole('link', { name: 'Renamed' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More actions for Renamed' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete…' }))
    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(screen.getByRole('link', { name: 'Renamed' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More actions for Renamed' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete…' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('heading', { name: 'No projects yet' })).toBeInTheDocument()
  })
})
