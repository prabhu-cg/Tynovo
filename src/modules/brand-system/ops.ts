import type { Clock } from '@/modules/brand-projects/model'
import { systemClock } from '@/modules/brand-projects/model'
import type { FontSource, FallbackStack, Project, Responsive, RoleFont, RoleKind, Sizes, TypographyRole } from '@/modules/brand-projects/schema'
import { catalogFontById, catalogFontFor, sourceFromCatalog, sourceFromName } from '@/modules/font-catalog/catalog'

/** Pure edits to the typography half of a project. Each returns the same object when nothing changes. */

const mapRoles = (p: Project, fn: (r: TypographyRole) => TypographyRole): Project => {
  const roles = p.typography.roles.map(fn)
  return roles.every((r, i) => r === p.typography.roles[i]) ? p : { ...p, typography: { ...p.typography, roles } }
}

export function updateRole(p: Project, roleId: string, patch: Partial<Omit<TypographyRole, 'id'>>): Project {
  return mapRoles(p, (r) => {
    if (r.id !== roleId) return r
    const next = { ...r, ...patch }
    return (Object.keys(patch) as (keyof typeof patch)[]).every((k) => Object.is(r[k], next[k])) ? r : next
  })
}

/** Link a role to the project's own typeface. Does nothing if the project has none. */
export function assignCustomTypeface(p: Project, roleId: string): Project {
  const face = p.customTypeface
  if (!face) return p
  return updateRole(p, roleId, { font: { kind: 'custom', typefaceId: face.id } })
}

/** Link a role to an existing font that is already in the project's font list. */
export function assignSource(p: Project, roleId: string, sourceId: string): Project {
  if (!p.fontSources.some((s) => s.id === sourceId)) return p
  return updateRole(p, roleId, { font: { kind: 'source', sourceId } })
}

export const sameFont = (a: RoleFont | null, b: RoleFont | null): boolean =>
  a === b || (a !== null && b !== null && a.kind === b.kind && (a.kind === 'custom' ? a.typefaceId === (b as typeof a).typefaceId : a.sourceId === (b as typeof a).sourceId))

/** Add a bundled catalog font to the project (once) and return its source id. */
export function addCatalogFont(p: Project, catalogId: string, clock: Clock = systemClock): { project: Project; sourceId: string } | null {
  const font = catalogFontById(catalogId)
  if (!font) return null
  const existing = p.fontSources.find((s) => s.kind === 'catalog' && catalogFontFor(s.family)?.id === catalogId)
  if (existing) return { project: p, sourceId: existing.id }
  const source = sourceFromCatalog(font, clock.newId())
  return { project: { ...p, fontSources: [...p.fontSources, source] }, sourceId: source.id }
}

/** Add an existing font the user names. A name already in the list is reused, not duplicated. */
export function addNamedFont(p: Project, family: string, fallback: FontSource['fallback'], clock: Clock = systemClock): { project: Project; sourceId: string } | null {
  const name = family.trim().replace(/\s+/g, ' ')
  if (!name || name.length > 200) return null
  const existing = p.fontSources.find((s) => s.family.toLowerCase() === name.toLowerCase())
  if (existing) return { project: p, sourceId: existing.id }
  if (p.fontSources.length >= 50) return null
  const source = sourceFromName(name, fallback, clock.newId())
  return { project: { ...p, fontSources: [...p.fontSources, source] }, sourceId: source.id }
}

/** Record what the user knows about an existing font's licence. Tynovo never infers it. */
export function setSourceLicense(p: Project, sourceId: string, license: FontSource['license']): Project {
  return { ...p, fontSources: p.fontSources.map((s) => (s.id === sourceId ? { ...s, license } : s)) }
}

/** Roles that use a font source. */
export const rolesUsingSource = (p: Project, sourceId: string): TypographyRole[] =>
  p.typography.roles.filter((r) => r.font?.kind === 'source' && r.font.sourceId === sourceId)

const withPairing = (p: Project, keep: (f: RoleFont) => boolean): Project => {
  const { primary, secondary } = p.typography.pairing
  const np = primary && keep(primary) ? primary : null
  const ns = secondary && keep(secondary) ? secondary : null
  return np === primary && ns === secondary ? p : { ...p, typography: { ...p.typography, pairing: { primary: np, secondary: ns } } }
}

/** Remove an existing font. Roles and pairing slots that used it go back to "none" rather than keeping a dead link. */
export function removeFontSource(p: Project, sourceId: string): Project {
  const next = mapRoles(p, (r) => (r.font?.kind === 'source' && r.font.sourceId === sourceId ? { ...r, font: null } : r))
  return withPairing({ ...next, fontSources: next.fontSources.filter((s) => s.id !== sourceId) }, (f) => !(f.kind === 'source' && f.sourceId === sourceId))
}

/** Remove the project's typeface. Roles and pairing slots that used it go back to "none". */
export function removeCustomTypeface(p: Project): Project {
  const face = p.customTypeface
  if (!face) return p
  const next = mapRoles(p, (r) => (r.font?.kind === 'custom' ? { ...r, font: null } : r))
  return withPairing({ ...next, customTypeface: null }, (f) => f.kind !== 'custom')
}

/* ---------- roles ---------- */

const ROLE_DEFAULTS: Record<RoleKind, Omit<TypographyRole, 'id' | 'name' | 'font'>> = {
  display: { kind: 'display', weight: 700, scaleStep: 6, lineHeight: 1.05, letterSpacingEm: -0.02 },
  heading: { kind: 'heading', weight: 600, scaleStep: 3, lineHeight: 1.2, letterSpacingEm: -0.01 },
  body: { kind: 'body', weight: 400, scaleStep: 0, lineHeight: 1.55, letterSpacingEm: 0 },
  ui: { kind: 'ui', weight: 500, scaleStep: 0, lineHeight: 1.3, letterSpacingEm: 0 },
  caption: { kind: 'caption', weight: 400, scaleStep: -1, lineHeight: 1.4, letterSpacingEm: 0.01 },
}
export const MAX_ROLES = 30

/** Add a role of a kind with that kind's defaults. Null when the name is empty or the project has the most roles it can hold. */
export function addRole(p: Project, name: string, kind: RoleKind, clock: Clock = systemClock): Project | null {
  const trimmed = name.trim().slice(0, 60)
  if (!trimmed || p.typography.roles.length >= MAX_ROLES) return null
  const role: TypographyRole = { id: clock.newId(), name: trimmed, font: null, ...ROLE_DEFAULTS[kind] }
  return { ...p, typography: { ...p.typography, roles: [...p.typography.roles, role] } }
}

/** Display, heading, body and interface text each need at least one role; captions are optional. */
export function canRemoveRole(p: Project, roleId: string): boolean {
  const role = p.typography.roles.find((r) => r.id === roleId)
  if (!role) return false
  return role.kind === 'caption' || p.typography.roles.some((r) => r.kind === role.kind && r.id !== roleId)
}

export function removeRole(p: Project, roleId: string): Project {
  if (!canRemoveRole(p, roleId)) return p
  return { ...p, typography: { ...p.typography, roles: p.typography.roles.filter((r) => r.id !== roleId) } }
}

/* ---------- pairing ---------- */

export function setPairing(p: Project, slot: 'primary' | 'secondary', font: RoleFont | null): Project {
  if (sameFont(p.typography.pairing[slot], font)) return p
  return { ...p, typography: { ...p.typography, pairing: { ...p.typography.pairing, [slot]: font } } }
}

/** Which slot a role follows: display and headings take the primary font, everything else the secondary. */
export const pairingSlotFor = (kind: RoleKind): 'primary' | 'secondary' => (kind === 'display' || kind === 'heading' ? 'primary' : 'secondary')

/** Set every role's font from the pairing. A slot that is empty leaves its roles alone. Roles can be changed again afterwards. */
export function applyPairing(p: Project): Project {
  return mapRoles(p, (r) => {
    const font = p.typography.pairing[pairingSlotFor(r.kind)]
    return font && !sameFont(r.font, font) ? { ...r, font } : r
  })
}

/** Roles whose font differs from what the pairing says for them. */
export const pairingDeviations = (p: Project): TypographyRole[] =>
  p.typography.roles.filter((r) => {
    const font = p.typography.pairing[pairingSlotFor(r.kind)]
    return font !== null && !sameFont(r.font, font)
  })

/* ---------- sizes, responsive settings, fallback stacks ---------- */

export function setHeadingStep(p: Project, index: number, step: number): Project {
  if (index < 0 || index > 5 || p.typography.sizes.headings[index] === step) return p
  const headings = [...p.typography.sizes.headings] as Sizes['headings']
  headings[index] = step
  return { ...p, typography: { ...p.typography, sizes: { ...p.typography.sizes, headings } } }
}

export function setBodyStep(p: Project, key: 'bodyLarge' | 'bodySmall', step: number): Project {
  return p.typography.sizes[key] === step ? p : { ...p, typography: { ...p.typography, sizes: { ...p.typography.sizes, [key]: step } } }
}

export function setResponsive(p: Project, patch: Partial<Responsive>): Project {
  const next = { ...p.typography.responsive, ...patch }
  return (Object.keys(patch) as (keyof Responsive)[]).every((k) => Object.is(next[k], p.typography.responsive[k])) ? p : { ...p, typography: { ...p.typography, responsive: next } }
}

/** Families typed as a list ("Helvetica Neue, Arial"): trimmed, de-duplicated, at most eight. Quotes and line breaks are not allowed in a name. */
export function parseFamilies(text: string): string[] {
  const out: string[] = []
  for (const part of text.split(/[,\n]/)) {
    const name = part.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ')
    if (name && name.length <= 200 && !out.some((x) => x.toLowerCase() === name.toLowerCase())) out.push(name)
  }
  return out.slice(0, 8)
}

export function setSourceFallback(p: Project, sourceId: string, stack: Pick<FontSource, 'fallbackFamilies' | 'fallback'>): Project {
  return { ...p, fontSources: p.fontSources.map((s) => (s.id === sourceId ? { ...s, fallbackFamilies: stack.fallbackFamilies, fallback: stack.fallback } : s)) }
}

export const setCustomFallback = (p: Project, stack: FallbackStack): Project => ({ ...p, typography: { ...p.typography, customFallback: stack } })
