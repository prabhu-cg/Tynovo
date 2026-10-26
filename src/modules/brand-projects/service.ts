import { StorageError, type ProjectRepository } from '@/modules/persistence/types'
import { parseProject } from './migrations'
import { recoverProject, type Recovery } from './recover'
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
  /** True when the file is a project file that failed validation, so "recover what can be read" is worth offering. */
  readonly recoverable: boolean
  constructor(message: string, recoverable = false) {
    super(message)
    this.recoverable = recoverable
  }
}

/** A project as opened, with what happened to it on the way from storage. */
export interface OpenedProject {
  project: Project
  /** Schema version the stored copy had, when it was upgraded on opening. The stored copy is unchanged until the next save. */
  migratedFrom: number | null
  /** The stored record before any upgrade, as JSON text, so the person can keep it. Present only when migratedFrom is set. */
  originalJson: string | null
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

  /** Open a project and report whether it had to be upgraded. Null if it does not exist. */
  async open(id: string): Promise<OpenedProject | null> {
    const raw = await this.repo.getRaw(id)
    if (raw === undefined) return null
    const parsed = parseProject(raw)
    if (!parsed.ok) throw new StorageError('unknown', parsed.message)
    return {
      project: parsed.project,
      migratedFrom: parsed.migratedFrom,
      originalJson: parsed.migratedFrom === null ? null : JSON.stringify(raw, null, 2),
    }
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
    if (!parsed.ok) throw new ImportError(parsed.message, parsed.reason === 'invalid' && looksLikeProjectFile(text))
    const { projects } = await this.repo.list()
    const ids = new Set(projects.map((p) => p.id))
    const project = prepareImport(parsed.project, ids, this.clock)
    await this.repo.save(project, { expectedUpdatedAt: null })
    return { project, renamedOnClash: project.id !== parsed.project.id }
  }

  /**
   * Salvage a stored record that cannot be opened. The readable parts become a NEW project; the damaged record
   * stays where it is until the person removes it.
   */
  async recoverRecord(id: string): Promise<Recovery> {
    const raw = await this.repo.getRaw(id)
    if (raw === undefined) throw new StorageError('not-found', 'That record no longer exists.')
    return this.storeRecovery(raw)
  }

  /** Same, for the text of a project file that failed validation. */
  async recoverFile(text: string): Promise<Recovery> {
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      throw new ImportError('File is not valid JSON.')
    }
    return this.storeRecovery(isObject(data) ? data['project'] : undefined)
  }

  private async storeRecovery(raw: unknown): Promise<Recovery> {
    const r = recoverProject(raw, this.clock)
    if (!r.ok) throw new ImportError(r.message)
    await this.repo.save(r.recovery.project, { expectedUpdatedAt: null })
    return r.recovery
  }

  private async requireProject(id: string): Promise<Project> {
    const project = await this.repo.get(id)
    if (!project) throw new StorageError('not-found', 'Project not found.')
    return project
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function looksLikeProjectFile(text: string): boolean {
  try {
    const d: unknown = JSON.parse(text)
    return isObject(d) && d['format'] === 'brand-typography-studio.project' && isObject(d['project'])
  } catch {
    return false
  }
}
