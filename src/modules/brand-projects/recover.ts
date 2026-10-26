import { migrateRaw } from './migrations'
import { createProject, DEFAULT_BRAND, systemClock, type Clock } from './model'
import {
  brandSchema,
  customTypefaceSchema,
  fallbackStackSchema,
  pairingSchema,
  responsiveSchema,
  sampleCopySchema,
  sizesSchema,
  TONES,
  USE_CASES,
  dnaSchema,
  exportRecordSchema,
  fontSourceSchema,
  glyphOverrideSchema,
  kerningPairSchema,
  licenseSchema,
  projectSchema,
  snapshotSchema,
  typeScaleSchema,
  typographyRoleSchema,
  variantSchema,
  type Project,
} from './schema'

export interface Recovery {
  /** A valid project built from what could be read. Always a new id, so the damaged original is never overwritten. */
  project: Project
  /** Plain-language account of everything that was dropped or replaced. Never empty: a project that needed no repair is not "recovered". */
  losses: string[]
}

export type RecoveryResult = { ok: true; recovery: Recovery } | { ok: false; message: string }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Salvage what can be read from a damaged or partly invalid project: each part is checked on its own, valid parts
 * are kept, broken parts are dropped or reset, and every loss is reported. Used only when a person asks for it,
 * and the result is a new project; the original record is left untouched.
 */
export function recoverProject(raw: unknown, clock: Clock = systemClock): RecoveryResult {
  const moved = migrateRaw(raw)
  if (!moved.ok) return { ok: false, message: moved.message }
  const rec = moved.record
  const losses: string[] = []
  const fresh = createProject('Recovered project', clock)

  const name = typeof rec['name'] === 'string' && rec['name'].trim() ? rec['name'].trim().slice(0, 100) : null
  if (!name) losses.push('The project name was missing or empty; it is now “Recovered project”.')

  const iso = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null)
  const createdAt = iso(rec['createdAt']) ?? (losses.push('The creation date was missing; it is now today.'), fresh.createdAt)

  const brandParsed = brandSchema.safeParse(rec['brand'])
  let brand = fresh.brand
  if (brandParsed.success) brand = brandParsed.data
  else if (isRecord(rec['brand'])) {
    const b = rec['brand']
    const traits = Array.isArray(b['personality']) ? b['personality'].filter((t): t is string => typeof t === 'string' && t.trim().length > 0 && t.length <= 40).slice(0, 12) : []
    const pick = <T extends string>(v: unknown, allowed: readonly T[]): T[] => (Array.isArray(v) ? allowed.filter((a) => v.includes(a)) : [])
    const prio = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5 ? v : 3)
    const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
    const copy = sampleCopySchema.safeParse(b['sampleCopy'])
    brand = {
      ...DEFAULT_BRAND,
      name: text(b['name'], 120).trim(),
      description: text(b['description'], 1000),
      personality: traits,
      useCases: pick(b['useCases'], USE_CASES),
      tones: pick(b['tones'], TONES),
      readabilityPriority: prio(b['readabilityPriority']),
      displayPriority: prio(b['displayPriority']),
      notes: text(b['notes'], 5000),
      sampleCopy: copy.success ? copy.data : {},
    }
    losses.push('Some brand notes or personality words were unreadable and were dropped.')
  } else losses.push('The brand section was unreadable; it is empty now.')

  const typo = isRecord(rec['typography']) ? rec['typography'] : {}
  const scaleParsed = typeScaleSchema.safeParse(typo['scale'])
  if (!scaleParsed.success) losses.push('The type scale was unreadable; the default scale is used.')
  const scale = scaleParsed.success ? scaleParsed.data : fresh.typography.scale
  const sizesParsed = sizesSchema.safeParse(typo['sizes'])
  const responsiveParsed = responsiveSchema.safeParse(typo['responsive'])
  const fallbackParsed = fallbackStackSchema.safeParse(typo['customFallback'])
  if (!sizesParsed.success || !responsiveParsed.success || !fallbackParsed.success) losses.push('Some size, responsive or fallback settings were unreadable; their defaults are used.')
  const pairingParsed = pairingSchema.safeParse(typo['pairing'])
  if (!pairingParsed.success) losses.push('The font pairing was unreadable and was cleared.')

  const keep = <T>(items: unknown, parse: (x: unknown) => { success: boolean; data?: T }): { ok: T[]; dropped: number } => {
    const list = Array.isArray(items) ? items : []
    const ok: T[] = []
    for (const it of list) {
      const r = parse(it)
      if (r.success) ok.push(r.data as T)
    }
    return { ok, dropped: list.length - ok.length }
  }
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

  const sources = keep(rec['fontSources'], (x) => fontSourceSchema.safeParse(x))
  if (sources.dropped) losses.push(`${plural(sources.dropped, 'font entry')} could not be read and ${sources.dropped === 1 ? 'was' : 'were'} dropped.`)

  const rolesIn = keep(typo['roles'], (x) => typographyRoleSchema.safeParse(x))
  if (rolesIn.dropped) losses.push(`${plural(rolesIn.dropped, 'typography role')} could not be read and ${rolesIn.dropped === 1 ? 'was' : 'were'} dropped.`)
  let roles = rolesIn.ok
  if (roles.length === 0) {
    roles = fresh.typography.roles
    losses.push('No readable typography roles were left; the default roles are used.')
  }

  let customTypeface: Project['customTypeface'] = null
  if (rec['customTypeface'] !== null && rec['customTypeface'] !== undefined) {
    const whole = customTypefaceSchema.safeParse(rec['customTypeface'])
    if (whole.success) customTypeface = whole.data
    else if (isRecord(rec['customTypeface'])) {
      const t = rec['customTypeface']
      const dna = dnaSchema.safeParse(t['dna'])
      const idOk = typeof t['id'] === 'string' && t['id'].length > 0 && t['id'].length <= 64
      if (!dna.success || !idOk) {
        losses.push('The custom typeface design could not be read and the typeface was dropped. Roles that used it have no font now.')
      } else {
        const overrides: Record<string, ReturnType<typeof glyphOverrideSchema.parse>> = {}
        let badOverrides = 0
        if (isRecord(t['overrides'])) {
          for (const [ch, o] of Object.entries(t['overrides'])) {
            const p = glyphOverrideSchema.safeParse(o)
            if (p.success) overrides[ch] = p.data
            else badOverrides++
          }
        }
        const kerning = keep(t['kerning'], (x) => kerningPairSchema.safeParse(x))
        const variants = keep(t['variants'], (x) => variantSchema.safeParse(x))
        const history = keep(t['history'], (x) => snapshotSchema.safeParse(x))
        const lic = licenseSchema.safeParse(t['license'])
        const engine = typeof t['engineVersion'] === 'number' && Number.isInteger(t['engineVersion']) && t['engineVersion'] >= 1 ? t['engineVersion'] : 1
        customTypeface = {
          id: t['id'] as string,
          familyName: typeof t['familyName'] === 'string' && t['familyName'] ? t['familyName'].slice(0, 100) : 'Recovered typeface',
          styleName: typeof t['styleName'] === 'string' && t['styleName'] ? t['styleName'].slice(0, 60) : 'Regular',
          engineVersion: engine,
          dna: dna.data,
          overrides,
          kerning: kerning.ok,
          variants: variants.ok,
          history: history.ok,
          license: lic.success ? lic.data : { name: 'Not yet chosen by the project owner', verified: false },
          copyright: typeof t['copyright'] === 'string' ? t['copyright'].slice(0, 500) : '',
        }
        const lost = [badOverrides && plural(badOverrides, 'glyph override'), kerning.dropped && plural(kerning.dropped, 'kerning pair'), variants.dropped && plural(variants.dropped, 'saved variant'), history.dropped && plural(history.dropped, 'restore point')].filter(Boolean)
        if (lost.length) losses.push(`Parts of the custom typeface were unreadable and dropped: ${lost.join(', ')}.`)
        if (!lic.success) losses.push('The typeface licence was unreadable; it is marked as not chosen.')
      }
    } else losses.push('The custom typeface was unreadable and was dropped.')
  }

  const history = keep(rec['exportHistory'], (x) => exportRecordSchema.safeParse(x))
  if (history.dropped) losses.push(`${plural(history.dropped, 'export history entry')} could not be read and ${history.dropped === 1 ? 'was' : 'were'} dropped.`)

  // Links between roles and fonts must point at something real.
  const linkOk = (f: NonNullable<Project['typography']['roles'][number]['font']>) => (f.kind === 'custom' ? customTypeface?.id === f.typefaceId : sources.ok.some((s) => s.id === f.sourceId))
  let unlinked = 0
  roles = roles.map((r) => {
    const f = r.font
    if (!f || linkOk(f)) return r
    unlinked++
    return { ...r, font: null }
  })
  const pairingIn = pairingParsed.success ? pairingParsed.data : fresh.typography.pairing
  const pairing = { primary: pairingIn.primary && linkOk(pairingIn.primary) ? pairingIn.primary : null, secondary: pairingIn.secondary && linkOk(pairingIn.secondary) ? pairingIn.secondary : null }
  if (unlinked) losses.push(`${plural(unlinked, 'role')} pointed at a font that could not be recovered and now ${unlinked === 1 ? 'has' : 'have'} no font assigned.`)

  const candidate = {
    schemaVersion: fresh.schemaVersion,
    id: clock.newId(),
    name: name ? `${name} (recovered)`.slice(0, 120) : 'Recovered project',
    createdAt,
    updatedAt: clock.now().toISOString(),
    brand,
    typography: { scale, roles, sizes: sizesParsed.success ? sizesParsed.data : fresh.typography.sizes, responsive: responsiveParsed.success ? responsiveParsed.data : fresh.typography.responsive, pairing, customFallback: fallbackParsed.success ? fallbackParsed.data : fresh.typography.customFallback },
    fontSources: sources.ok,
    customTypeface,
    exportHistory: history.ok,
  }
  const done = projectSchema.safeParse(candidate)
  if (!done.success) return { ok: false, message: `Nothing usable could be recovered (${done.error.issues[0]?.message ?? 'unknown problem'}).` }
  if (losses.length === 0) losses.push('Nothing was dropped. The record could not be opened for another reason, such as a damaged id; it was copied as a new project.')
  return { ok: true, recovery: { project: done.data, losses } }
}
