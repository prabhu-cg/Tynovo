import type { ExportRecord, Project } from '@/modules/brand-projects/schema'

/** The project's own font as a finished, checked file. Present only when the font passed every export check. */
export interface CustomFontFile {
  /** e.g. "Northwind-Regular.ttf" */
  filename: string
  bytes: Uint8Array
  mimeType: string
  format: 'ttf' | 'otf'
  sha256: string
}

/** Everything the generators need. Pure data, so every generator is a pure function. */
export interface ExportInput {
  /** The saved project. Never an unsaved draft. */
  project: Project
  /** `contentRevision(project)`. Written into every file so it can be matched with the project later. */
  revision: string
  /** ISO time, written into the files. */
  generatedAt: string
  /** Null when the project has no typeface, or when its font file could not be built (see `fontBlocked`). */
  font: CustomFontFile | null
  /** True when the custom typeface is used by a role but no file could be produced. */
  fontBlocked: boolean
}

export type ExportFileId = 'spec' | 'tokens' | 'css' | 'specimen' | 'pdf' | 'manifest' | 'project' | 'font' | 'package'

export interface ExportFile {
  id: ExportFileId
  /** Name inside the package and when downloaded. */
  path: string
  title: string
  description: string
  mimeType: string
  bytes: Uint8Array
  sha256: string
  kind: ExportRecord['kind']
  /** False when the file cannot be offered, with the reason. */
  available: boolean
  unavailableReason?: string
}
