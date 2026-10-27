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

/** Largest project file Tynovo will read. A real project is well under 1 MB; the cap keeps a wrong or hostile file from freezing the page. */
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024

export const importTooLargeMessage = (name: string) =>
  `“${name}” is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB, which is far more than a Tynovo project. It was not opened.`

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

/** A built-in project (the sample) cannot be changed, renamed or deleted. Copy it to get one you own. */
export class ReadOnlyError extends Error {
  override name = 'ReadOnlyError'
  constructor(message = 'This project is a read-only sample. Duplicate it to make a copy you can edit.') {
    super(message)
  }
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
  private readonly builtIns: ReadonlyMap<string, Project>

  /** `builtIns` are projects that ship with the app (the sample): readable and copyable, never writable, never in the list. */
  constructor(repo: ProjectRepository, clock: Clock = systemClock, builtIns: readonly Project[] = []) {
    this.repo = repo
    this.clock = clock
    this.builtIns = new Map(builtIns.map((p) => [p.id, p]))
  }

  isReadOnly(id: string): boolean {
    return this.builtIns.has(id)
  }

  /** The built-in projects, for screens that show them next to a person's own. */
  builtInProjects(): Project[] {
    return [...this.builtIns.values()].map((p) => structuredClone(p))
  }

  list() {
    return this.repo.list()
  }

  async get(id: string): Promise<Project | null> {
    const built = this.builtIns.get(id)
    return built ? structuredClone(built) : this.repo.get(id)
  }

  /** Open a project and report whether it had to be upgraded. Null if it does not exist. */
  async open(id: string): Promise<OpenedProject | null> {
    const built = this.builtIns.get(id)
    if (built) return { project: structuredClone(built), migratedFrom: null, originalJson: null }
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
    if (this.builtIns.has(edited.id)) throw new ReadOnlyError()
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
    if (this.builtIns.has(id)) throw new ReadOnlyError()
    const source = await this.requireProject(id)
    const renamed = renameProject(source, name, this.clock)
    await this.repo.save(renamed, { expectedUpdatedAt: source.updatedAt })
    return renamed
  }

  async delete(id: string): Promise<void> {
    if (this.builtIns.has(id)) throw new ReadOnlyError()
    return this.repo.delete(id)
  }

  /** Import a project file. Existing projects are never replaced; an id clash becomes a copy. */
  async importFile(text: string): Promise<{ project: Project; renamedOnClash: boolean }> {
    if (text.length > MAX_IMPORT_BYTES) throw new ImportError(importTooLargeMessage('This file'))
    const parsed = parseProjectFile(text)
    if (!parsed.ok) throw new ImportError(parsed.message, parsed.reason === 'invalid' && looksLikeProjectFile(text))
    const { projects } = await this.repo.list()
    const ids = new Set([...projects.map((p) => p.id), ...this.builtIns.keys()])
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
    if (text.length > MAX_IMPORT_BYTES) throw new ImportError(importTooLargeMessage('This file'))
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
    const project = await this.get(id)
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
