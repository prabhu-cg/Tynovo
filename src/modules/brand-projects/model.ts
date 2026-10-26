import { parseProject, type ParseResult } from './migrations'
import { CURRENT_SCHEMA_VERSION, type Brand, type Project, type Responsive, type Sizes, type Typography, type TypographyRole, type TypeScale } from './schema'

/** Pure project operations. Time and id generation are injectable for deterministic tests. */
export interface Clock {
  now(): Date
  newId(): string
}

export const systemClock: Clock = {
  now: () => new Date(),
  newId: () => crypto.randomUUID(),
}

export const DEFAULT_SCALE: TypeScale = { baseSizePx: 16, ratio: 1.25, stepsDown: 2, stepsUp: 6 }
export const DEFAULT_SIZES: Sizes = { headings: [5, 4, 3, 2, 1, 0], bodyLarge: 1, bodySmall: -1 }
export const DEFAULT_RESPONSIVE: Responsive = { enabled: false, minViewportPx: 320, maxViewportPx: 1280, minBaseSizePx: 14, minRatio: 1.125 }
export const DEFAULT_BRAND: Brand = { name: '', description: '', personality: [], useCases: [], tones: [], readabilityPriority: 3, displayPriority: 3, notes: '', sampleCopy: {} }

export const defaultTypography = (roles: TypographyRole[]): Typography => ({
  scale: { ...DEFAULT_SCALE },
  roles,
  sizes: structuredClone(DEFAULT_SIZES),
  responsive: { ...DEFAULT_RESPONSIVE },
  pairing: { primary: null, secondary: null },
  customFallback: { families: [], generic: 'sans-serif' },
})

function defaultRoles(clock: Clock): TypographyRole[] {
  const role = (
    name: string,
    kind: TypographyRole['kind'],
    weight: number,
    scaleStep: number,
    lineHeight: number,
    letterSpacingEm: number,
  ): TypographyRole => ({ id: clock.newId(), name, kind, font: null, weight, scaleStep, lineHeight, letterSpacingEm })
  return [
    role('Display', 'display', 700, 6, 1.05, -0.02),
    role('Heading', 'heading', 600, 3, 1.2, -0.01),
    role('Body', 'body', 400, 0, 1.55, 0),
    role('UI', 'ui', 500, 0, 1.3, 0),
    role('Caption', 'caption', 400, -1, 1.4, 0.01),
  ]
}

export function createProject(name: string, clock: Clock = systemClock): Project {
  const at = clock.now().toISOString()
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: clock.newId(),
    name: name.trim() || 'Untitled project',
    createdAt: at,
    updatedAt: at,
    brand: structuredClone(DEFAULT_BRAND),
    typography: defaultTypography(defaultRoles(clock)),
    fontSources: [],
    customTypeface: null,
    exportHistory: [],
  }
}

/** Deep copy with a fresh id and timestamps. Export history is not carried over. */
export function duplicateProject(source: Project, clock: Clock = systemClock): Project {
  const at = clock.now().toISOString()
  return {
    ...structuredClone(source),
    id: clock.newId(),
    name: `${source.name} (copy)`.slice(0, 120),
    createdAt: at,
    updatedAt: at,
    exportHistory: [],
  }
}

export function renameProject(project: Project, name: string, clock: Clock = systemClock): Project {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Project name cannot be empty.')
  return { ...project, name: trimmed.slice(0, 120), updatedAt: clock.now().toISOString() }
}

/* ---------- Project file (export / import) ---------- */

export const PROJECT_FILE_FORMAT = 'brand-typography-studio.project'

export interface ProjectFile {
  format: typeof PROJECT_FILE_FORMAT
  schemaVersion: number
  exportedAt: string
  project: Project
}

export function serializeProject(project: Project, clock: Clock = systemClock): string {
  const file: ProjectFile = {
    format: PROJECT_FILE_FORMAT,
    schemaVersion: project.schemaVersion,
    exportedAt: clock.now().toISOString(),
    project,
  }
  return JSON.stringify(file, null, 2)
}

export function projectFilename(project: Project): string {
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'
  return `${slug}.btstudio.json`
}

/** Parse the text of a project file. Never throws. */
export function parseProjectFile(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'invalid', message: 'File is not valid JSON.' }
  }
  if (typeof data !== 'object' || data === null) {
    return { ok: false, reason: 'not-an-object', message: 'File does not contain a project.' }
  }
  const file = data as Record<string, unknown>
  if (file['format'] !== PROJECT_FILE_FORMAT) {
    return { ok: false, reason: 'invalid', message: 'This is not a Brand Typography Studio project file.' }
  }
  return parseProject(file['project'])
}

/**
 * An imported project must never replace an existing one silently:
 * if its id is already taken it is re-identified as a copy.
 */
export function prepareImport(project: Project, existingIds: ReadonlySet<string>, clock: Clock = systemClock): Project {
  if (!existingIds.has(project.id)) return project
  const at = clock.now().toISOString()
  return { ...project, id: clock.newId(), name: `${project.name} (imported)`.slice(0, 120), updatedAt: at }
}
