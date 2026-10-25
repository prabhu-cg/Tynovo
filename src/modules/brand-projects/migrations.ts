import type { ZodType } from 'zod'
import { CURRENT_SCHEMA_VERSION, projectSchema, type Project } from './schema'

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * v1 stored a Phase-0 "proof" typeface: three loose numbers plus its generated glyphs. v2 stores the design
 * DNA and regenerates glyphs from it. The three numbers map onto the new DNA; the old generated outlines are
 * dropped (they were derived data), so the regenerated glyphs can differ in detail. User data is kept:
 * name, licence, copyright, kerning and per-glyph overrides (advance widths and frozen outlines).
 */
function migrateV1toV2(raw: Record<string, unknown>): Record<string, unknown> {
  const tf = raw['customTypeface']
  if (typeof tf !== 'object' || tf === null) return raw
  const old = tf as Record<string, unknown>
  const params = (typeof old['params'] === 'object' && old['params'] !== null ? old['params'] : {}) as Record<string, unknown>
  const oldOverrides = typeof old['overrides'] === 'object' && old['overrides'] !== null ? (old['overrides'] as Record<string, Record<string, unknown>>) : {}
  const overrides: Record<string, unknown> = {}
  for (const [char, o] of Object.entries(oldOverrides)) {
    const kept: Record<string, unknown> = {}
    if (o['advanceWidth'] !== undefined) kept['advanceWidth'] = o['advanceWidth']
    if (o['contours'] !== undefined) kept['contours'] = o['contours']
    if (Object.keys(kept).length > 0) overrides[char] = kept
  }
  const stem = num(params['stem'], 100)
  const width = num(params['width'], 620)
  const radius = num(params['radius'], 220)
  const dna = {
    family: 'geometric',
    capHeight: 700,
    xHeightRatio: 0.72,
    ascenderRise: 30,
    descenderDepth: 200,
    widthScale: clamp(Math.round((width / 620) * 100) / 100, 0.6, 1.6),
    strokeThickness: clamp(Math.round(stem), 30, 200),
    contrast: 1,
    roundness: clamp(Math.round((radius / 350) * 100) / 100, 0, 1),
    overshoot: 12,
    crossbarPosition: 0.5,
    grid: 0,
    cornerStyle: 'sharp',
    cornerRadius: 0,
    innerCornerRatio: 0,
    terminal: 'flat',
    aperture: 0.32,
    sidebearing: 60,
    sidebearingBalance: 0,
    tracking: 0,
    spaceWidth: 280,
  }
  return {
    ...raw,
    customTypeface: {
      id: old['id'],
      familyName: old['familyName'],
      styleName: old['styleName'],
      engineVersion: 1,
      dna,
      overrides,
      kerning: old['kerning'] ?? [],
      variants: [],
      history: [],
      license: old['license'],
      copyright: old['copyright'] ?? '',
    },
  }
}

/** A step upgrades a raw record from version N to N + 1. Steps must be pure. */
export type MigrationStep = (raw: Record<string, unknown>) => Record<string, unknown>

/**
 * Registry keyed by the version a step migrates FROM.
 * Add `n: migrateVnToVn+1` whenever CURRENT_SCHEMA_VERSION is bumped.
 */
export const MIGRATIONS: Readonly<Record<number, MigrationStep>> = { 1: migrateV1toV2 }

export type ParseResult =
  | { ok: true; project: Project; migratedFrom: number | null }
  | { ok: false; reason: 'not-an-object' | 'missing-version' | 'newer-version' | 'no-migration' | 'invalid'; message: string }

/**
 * Validate and, if needed, migrate an untrusted record (IndexedDB row or imported file).
 * Never throws and never mutates its input.
 */
export function parseProject(
  raw: unknown,
  {
    migrations = MIGRATIONS,
    target = CURRENT_SCHEMA_VERSION,
    schema = projectSchema,
  }: { migrations?: Readonly<Record<number, MigrationStep>>; target?: number; schema?: ZodType<Project> } = {},
): ParseResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: 'not-an-object', message: 'Project data is not an object.' }
  }
  let record = structuredClone(raw) as Record<string, unknown>
  const version = record['schemaVersion']
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, reason: 'missing-version', message: 'Project has no valid schemaVersion.' }
  }
  if (version > target) {
    return {
      ok: false,
      reason: 'newer-version',
      message: `Project was saved by a newer version of the app (schema ${version}; this app understands up to ${target}).`,
    }
  }
  let current = version
  while (current < target) {
    const step = migrations[current]
    if (!step) {
      return { ok: false, reason: 'no-migration', message: `No migration from schema ${current}.` }
    }
    record = { ...step(record), schemaVersion: current + 1 }
    current += 1
  }
  const parsed = schema.safeParse(record)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const where = first ? first.path.join('.') || '(root)' : '(root)'
    return { ok: false, reason: 'invalid', message: `Invalid project data at ${where}: ${first?.message ?? 'unknown'}` }
  }
  return { ok: true, project: parsed.data, migratedFrom: version === target ? null : version }
}
