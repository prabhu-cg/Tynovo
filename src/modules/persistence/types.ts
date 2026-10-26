import type { Project, ProjectSummary } from '@/modules/brand-projects/schema'

export type StorageErrorCode = 'unavailable' | 'quota' | 'conflict' | 'not-found' | 'unknown'

export class StorageError extends Error {
  readonly code: StorageErrorCode
  constructor(code: StorageErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'StorageError'
    this.code = code
  }
}

/** A stored record that could not be read as a valid project. It is kept, never deleted automatically. */
export interface UnreadableRecord {
  id: string
  reason: string
  raw: unknown
}

export interface ProjectListing {
  projects: ProjectSummary[]
  unreadable: UnreadableRecord[]
}

export interface SaveOptions {
  /**
   * `updatedAt` of the version the caller loaded, or null for a brand-new project.
   * If the stored copy differs, save fails with a `conflict` error instead of overwriting.
   */
  expectedUpdatedAt: string | null
}

export interface ProjectRepository {
  /** 'indexeddb' persists; 'memory' is a non-persistent fallback the UI must disclose. */
  readonly kind: 'indexeddb' | 'memory'
  list(): Promise<ProjectListing>
  get(id: string): Promise<Project | null>
  /** The stored record exactly as written, before any migration or validation. `undefined` if there is none. */
  getRaw(id: string): Promise<unknown>
  save(project: Project, options: SaveOptions): Promise<void>
  /** Delete by id. Also the only way to remove an unreadable record, on explicit user request. */
  delete(id: string): Promise<void>
}
