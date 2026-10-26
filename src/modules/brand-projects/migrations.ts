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

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Role kind for a v2 role, which had none: from its name, else from how large it is on the scale. */
export function inferRoleKind(name: unknown, scaleStep: unknown): 'display' | 'heading' | 'body' | 'ui' {
  const n = typeof name === 'string' ? name.toLowerCase() : ''
  if (/display|hero|title/.test(n)) return 'display'
  if (/head/.test(n)) return 'heading'
  if (/caption|label|button|ui|nav|small/.test(n)) return 'ui'
  if (/body|text|paragraph/.test(n)) return 'body'
  const step = typeof scaleStep === 'number' ? scaleStep : 0
  return step >= 4 ? 'display' : step >= 1 ? 'heading' : step < 0 ? 'ui' : 'body'
}

/**
 * v2 -> v3 (Phase 5): roles get a `kind` and a typed `font` link instead of `fontSourceId`; font sources get a
 * CSS `fallback`; the never-used 'generated' font-source kind goes away because the project's own typeface is
 * linked by id instead of being copied into the font list.
 */
function migrateV2toV3(raw: Record<string, unknown>): Record<string, unknown> {
  const typeface = isRecord(raw['customTypeface']) ? raw['customTypeface'] : null
  const typefaceId = typeface && typeof typeface['id'] === 'string' ? typeface['id'] : null
  const sources = Array.isArray(raw['fontSources']) ? raw['fontSources'] : []
  const generatedIds = new Set<unknown>()
  const keptSources: unknown[] = []
  for (const s of sources) {
    if (isRecord(s) && s['kind'] === 'generated') generatedIds.add(s['id'])
    else keptSources.push(isRecord(s) ? { fallback: 'sans-serif', ...s } : s)
  }
  const typography = isRecord(raw['typography']) ? raw['typography'] : {}
  const roles = Array.isArray(typography['roles']) ? typography['roles'] : []
  const migratedRoles = roles.map((r) => {
    if (!isRecord(r)) return r
    const { fontSourceId, ...rest } = r
    let font: unknown = null
    if (typeof fontSourceId === 'string') {
      if (generatedIds.has(fontSourceId)) font = typefaceId ? { kind: 'custom', typefaceId } : null
      else font = { kind: 'source', sourceId: fontSourceId }
    }
    return { ...rest, kind: inferRoleKind(r['name'], r['scaleStep']), font }
  })
  return { ...raw, fontSources: keptSources, typography: { ...typography, roles: migratedRoles } }
}

/**
 * v3 -> v4 (the brand typography system): the brand gains a name, description, use cases, tones, priorities and
 * saved sample copy; typography gains heading and body sizes, responsive settings, a pairing and a fallback
 * stack for the custom typeface; font sources gain fallback families; roles may be of the new 'caption' kind.
 * A role named like a caption or label that was a 'ui' role becomes a caption, and a UI role is added if that
 * leaves none, so every project has a role for interface text.
 */
function migrateV3toV4(raw: Record<string, unknown>): Record<string, unknown> {
  const brand = isRecord(raw['brand']) ? raw['brand'] : {}
  const typography = isRecord(raw['typography']) ? raw['typography'] : {}
  const roles = Array.isArray(typography['roles']) ? typography['roles'] : []
  let migrated = roles.map((r) => (isRecord(r) && r['kind'] === 'ui' && /caption|label/i.test(String(r['name'])) ? { ...r, kind: 'caption' } : r))
  const hasUi = migrated.some((r) => isRecord(r) && r['kind'] === 'ui')
  if (!hasUi && migrated.length > 0 && migrated.length < 30) {
    const base = typeof raw['id'] === 'string' ? raw['id'].slice(0, 50) : 'project'
    migrated = [...migrated, { id: `${base}-ui-role`, name: 'UI', kind: 'ui', font: null, weight: 500, scaleStep: 0, lineHeight: 1.3, letterSpacingEm: 0 }]
  }
  const sources = Array.isArray(raw['fontSources']) ? raw['fontSources'] : []
  return {
    ...raw,
    brand: { name: '', description: '', useCases: [], tones: [], readabilityPriority: 3, displayPriority: 3, sampleCopy: {}, ...brand },
    typography: {
      ...typography,
      roles: migrated,
      sizes: { headings: [5, 4, 3, 2, 1, 0], bodyLarge: 1, bodySmall: -1 },
      responsive: { enabled: false, minViewportPx: 320, maxViewportPx: 1280, minBaseSizePx: 14, minRatio: 1.125 },
      pairing: { primary: null, secondary: null },
      customFallback: { families: [], generic: 'sans-serif' },
    },
    fontSources: sources.map((s) => (isRecord(s) ? { fallbackFamilies: [], ...s } : s)),
  }
}

/** A step upgrades a raw record from version N to N + 1. Steps must be pure. */
export type MigrationStep = (raw: Record<string, unknown>) => Record<string, unknown>

/**
 * Registry keyed by the version a step migrates FROM.
 * Add `n: migrateVnToVn+1` whenever CURRENT_SCHEMA_VERSION is bumped.
 */
export const MIGRATIONS: Readonly<Record<number, MigrationStep>> = { 1: migrateV1toV2, 2: migrateV2toV3, 3: migrateV3toV4 }

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
  const moved = migrateRaw(raw, { migrations, target })
  if (!moved.ok) return moved
  const parsed = schema.safeParse(moved.record)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const where = first ? first.path.join('.') || '(root)' : '(root)'
    return { ok: false, reason: 'invalid', message: `Invalid project data at ${where}: ${first?.message ?? 'unknown'}` }
  }
  return { ok: true, project: parsed.data, migratedFrom: moved.from === target ? null : moved.from }
}

export type MigrateResult =
  | { ok: true; record: Record<string, unknown>; from: number }
  | Extract<ParseResult, { ok: false }>

/** Run the migration chain without validating the result. Used by parseProject and by data recovery. */
export function migrateRaw(
  raw: unknown,
  { migrations = MIGRATIONS, target = CURRENT_SCHEMA_VERSION }: { migrations?: Readonly<Record<number, MigrationStep>>; target?: number } = {},
): MigrateResult {
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
    try {
      record = { ...step(record), schemaVersion: current + 1 }
    } catch (e) {
      return { ok: false, reason: 'invalid', message: `Upgrading from schema ${current} failed: ${e instanceof Error ? e.message : 'unknown error'}` }
    }
    current += 1
  }
  return { ok: true, record, from: version }
}
