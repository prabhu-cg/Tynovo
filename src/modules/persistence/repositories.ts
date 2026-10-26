import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { parseProject } from '@/modules/brand-projects/migrations'
import { summarize, type Project } from '@/modules/brand-projects/schema'
import {
  StorageError,
  type ProjectListing,
  type ProjectRepository,
  type SaveOptions,
  type UnreadableRecord,
} from './types'

export const DB_NAME = 'brand-typography-studio'
const DB_VERSION = 1
const STORE = 'projects'

interface StudioDB extends DBSchema {
  projects: {
    key: string
    /** Stored as plain JSON-compatible objects; validated on read, not trusted. */
    value: unknown
  }
}

function toListing(rows: unknown[]): ProjectListing {
  const projects: ProjectListing['projects'] = []
  const unreadable: UnreadableRecord[] = []
  for (const raw of rows) {
    const parsed = parseProject(raw)
    const rawId = typeof raw === 'object' && raw !== null && 'id' in raw ? String((raw as { id: unknown }).id) : '(unknown)'
    if (parsed.ok) projects.push(summarize(parsed.project))
    else unreadable.push({ id: rawId, reason: parsed.message, raw })
  }
  projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return { projects, unreadable }
}

function mapError(e: unknown): StorageError {
  if (e instanceof StorageError) return e
  const name = e instanceof DOMException || e instanceof Error ? e.name : ''
  if (name === 'QuotaExceededError') {
    return new StorageError('quota', 'Browser storage is full. Export your projects, free some space and try again.', { cause: e })
  }
  return new StorageError('unknown', e instanceof Error ? e.message : 'Unknown storage error.', { cause: e })
}

function checkConflict(stored: unknown, { expectedUpdatedAt }: SaveOptions): void {
  const storedUpdated =
    typeof stored === 'object' && stored !== null && 'updatedAt' in stored ? String((stored as { updatedAt: unknown }).updatedAt) : null
  if (stored === undefined) {
    if (expectedUpdatedAt !== null) {
      throw new StorageError('conflict', 'This project no longer exists in storage (it may have been deleted in another tab).')
    }
    return
  }
  if (expectedUpdatedAt === null) {
    throw new StorageError('conflict', 'A project with this id already exists.')
  }
  if (storedUpdated !== expectedUpdatedAt) {
    throw new StorageError('conflict', 'This project was changed elsewhere (another tab?) since you opened it.')
  }
}

export class IndexedDbProjectRepository implements ProjectRepository {
  readonly kind = 'indexeddb' as const
  private readonly db: IDBPDatabase<StudioDB>
  private constructor(db: IDBPDatabase<StudioDB>) {
    this.db = db
  }

  static async open(name: string = DB_NAME): Promise<IndexedDbProjectRepository> {
    if (typeof indexedDB === 'undefined') throw new StorageError('unavailable', 'IndexedDB is not available in this browser.')
    try {
      const db = await openDB<StudioDB>(name, DB_VERSION, {
        upgrade(database) {
          database.createObjectStore(STORE, { keyPath: 'id' })
        },
      })
      return new IndexedDbProjectRepository(db)
    } catch (e) {
      throw new StorageError('unavailable', 'Browser storage could not be opened (private mode or blocked site data?).', { cause: e })
    }
  }

  async list(): Promise<ProjectListing> {
    try {
      return toListing(await this.db.getAll(STORE))
    } catch (e) {
      throw mapError(e)
    }
  }

  async get(id: string): Promise<Project | null> {
    try {
      const raw = await this.db.get(STORE, id)
      if (raw === undefined) return null
      const parsed = parseProject(raw)
      if (!parsed.ok) throw new StorageError('unknown', parsed.message)
      return parsed.project
    } catch (e) {
      throw mapError(e)
    }
  }

  async getRaw(id: string): Promise<unknown> {
    try {
      return await this.db.get(STORE, id)
    } catch (e) {
      throw mapError(e)
    }
  }

  async save(project: Project, options: SaveOptions): Promise<void> {
    try {
      // Compare-and-put inside one readwrite transaction so two tabs cannot interleave.
      const tx = this.db.transaction(STORE, 'readwrite')
      const stored = await tx.store.get(project.id)
      checkConflict(stored, options)
      await tx.store.put(project)
      await tx.done
    } catch (e) {
      throw mapError(e)
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.delete(STORE, id)
    } catch (e) {
      throw mapError(e)
    }
  }

  close(): void {
    this.db.close()
  }
}

/** Non-persistent fallback. The UI must say so; nothing here survives a reload. */
export class MemoryProjectRepository implements ProjectRepository {
  readonly kind = 'memory' as const
  private readonly rows = new Map<string, unknown>()

  async list(): Promise<ProjectListing> {
    return toListing([...this.rows.values()])
  }
  async get(id: string): Promise<Project | null> {
    const raw = this.rows.get(id)
    if (raw === undefined) return null
    const parsed = parseProject(raw)
    if (!parsed.ok) throw new StorageError('unknown', parsed.message)
    return parsed.project
  }
  async getRaw(id: string): Promise<unknown> {
    const raw = this.rows.get(id)
    return raw === undefined ? undefined : structuredClone(raw)
  }
  async save(project: Project, options: SaveOptions): Promise<void> {
    checkConflict(this.rows.get(project.id), options)
    this.rows.set(project.id, structuredClone(project))
  }
  async delete(id: string): Promise<void> {
    this.rows.delete(id)
  }
}

export interface RepositoryHandle {
  repo: ProjectRepository
  /** Set when we had to fall back; shown to the user. */
  warning: string | null
}

export async function openRepository(): Promise<RepositoryHandle> {
  try {
    return { repo: await IndexedDbProjectRepository.open(), warning: null }
  } catch (e) {
    const detail = e instanceof StorageError ? e.message : 'Browser storage is unavailable.'
    return {
      repo: new MemoryProjectRepository(),
      warning: `${detail} Projects will not be saved after you close this tab. Use Export to keep your work.`,
    }
  }
}
