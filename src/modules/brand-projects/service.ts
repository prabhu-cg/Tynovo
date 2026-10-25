import { StorageError, type ProjectRepository } from '@/modules/persistence/types'
import { parseProject } from './migrations'
import {
  createProject,
  duplicateProject,
  parseProjectFile,
  prepareImport,
  renameProject,
  systemClock,
  type Clock,
} from './model'
import type { Project } from './schema'

export class ImportError extends Error {
  override name = 'ImportError'
}

export class ValidationError extends Error {
  override name = 'ValidationError'
}

/** Nothing invalid may reach storage: a bad record would later show up as unreadable. */
function assertValid(project: Project): void {
  const r = parseProject(project)
  if (!r.ok) throw new ValidationError(r.message)
}

/** Use-cases over a repository. No React; swap the repository in tests. */
export class ProjectService {
  private readonly repo: ProjectRepository
  private readonly clock: Clock

  constructor(repo: ProjectRepository, clock: Clock = systemClock) {
    this.repo = repo
    this.clock = clock
  }

  list() {
    return this.repo.list()
  }

  get(id: string) {
    return this.repo.get(id)
  }

  async create(name: string): Promise<Project> {
    const project = createProject(name, this.clock)
    await this.repo.save(project, { expectedUpdatedAt: null })
    return project
  }

  /** Save edits made to a loaded project. Fails with `conflict` rather than overwriting newer data. */
  async save(edited: Project, loadedUpdatedAt: string): Promise<Project> {
    const next: Project = { ...edited, updatedAt: this.clock.now().toISOString() }
    assertValid(next)
    await this.repo.save(next, { expectedUpdatedAt: loadedUpdatedAt })
    return next
  }

  /** Store a project as a new copy (used to resolve conflicts without losing either side). */
  async saveAsCopy(project: Project): Promise<Project> {
    const copy = duplicateProject(project, this.clock)
    assertValid(copy)
    await this.repo.save(copy, { expectedUpdatedAt: null })
    return copy
  }

  async duplicate(id: string): Promise<Project> {
    const source = await this.requireProject(id)
    return this.saveAsCopy(source)
  }

  async rename(id: string, name: string): Promise<Project> {
    const source = await this.requireProject(id)
    const renamed = renameProject(source, name, this.clock)
    await this.repo.save(renamed, { expectedUpdatedAt: source.updatedAt })
    return renamed
  }

  delete(id: string) {
    return this.repo.delete(id)
  }

  /** Import a project file. Existing projects are never replaced; an id clash becomes a copy. */
  async importFile(text: string): Promise<{ project: Project; renamedOnClash: boolean }> {
    const parsed = parseProjectFile(text)
    if (!parsed.ok) throw new ImportError(parsed.message)
    const { projects } = await this.repo.list()
    const ids = new Set(projects.map((p) => p.id))
    const project = prepareImport(parsed.project, ids, this.clock)
    await this.repo.save(project, { expectedUpdatedAt: null })
    return { project, renamedOnClash: project.id !== parsed.project.id }
  }

  private async requireProject(id: string): Promise<Project> {
    const project = await this.repo.get(id)
    if (!project) throw new StorageError('not-found', 'Project not found.')
    return project
  }
}
