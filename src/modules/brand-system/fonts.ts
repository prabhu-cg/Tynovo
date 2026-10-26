import type { CustomTypeface, FontSource, License, Project, RoleFont, TypographyRole } from '@/modules/brand-projects/schema'
import { cssString, slug } from './text'

/**
 * How a role's font is known to the rest of the studio. `origin` is the distinction users see everywhere:
 *  custom   the project's own generated typeface
 *  catalog  an existing font that ships with the studio
 *  system   an existing font the user named (installed on the viewer's device or supplied separately)
 *  none     nothing assigned yet
 *  broken   a link that points at something that no longer exists
 */
export type FontOrigin = 'custom' | 'catalog' | 'system' | 'uploaded' | 'none' | 'broken'

export interface ResolvedFont {
  origin: FontOrigin
  /** Name shown to people and written into exports. */
  family: string
  /** CSS `font-family` value for in-browser previews (the custom typeface uses its registered preview name). */
  previewStack: string
  /** CSS `font-family` value for exports (the custom typeface uses its real name, which its @font-face declares). */
  exportStack: string
  license: License | null
  source: FontSource | null
}

export const ORIGIN_LABEL: Record<FontOrigin, string> = {
  custom: 'Custom typeface',
  catalog: 'Existing font, bundled',
  system: 'Existing font, by name',
  uploaded: 'Existing font, uploaded',
  none: 'No font assigned',
  broken: 'Missing font',
}

export const isExisting = (o: FontOrigin) => o === 'catalog' || o === 'system' || o === 'uploaded'

/** Quote a family name for a CSS font-family list. */
export const quoteFamily = (name: string): string => cssString([...name].map((c) => (c.codePointAt(0)! < 0x20 || c.codePointAt(0) === 0x7f ? ' ' : c)).join(''))

/** The name the browser knows the project's typeface by while previewing. Unique to the typeface, never a real font's name. */
export const previewFamilyName = (face: Pick<CustomTypeface, 'id'>): string => `BTS Custom ${face.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 24)}`

export const stackOf = (families: string[], fallback: string): string => [...families.map(quoteFamily), fallback].join(', ')

export function resolveFont(project: Pick<Project, 'fontSources' | 'customTypeface' | 'typography'>, font: RoleFont | null): ResolvedFont {
  if (!font) return { origin: 'none', family: 'No font assigned', previewStack: 'inherit', exportStack: 'inherit', license: null, source: null }
  if (font.kind === 'custom') {
    const face = project.customTypeface
    if (!face || face.id !== font.typefaceId) {
      return { origin: 'broken', family: 'Custom typeface (removed)', previewStack: 'inherit', exportStack: 'inherit', license: null, source: null }
    }
    return {
      origin: 'custom',
      family: face.familyName,
      previewStack: stackOf([previewFamilyName(face), ...project.typography.customFallback.families], project.typography.customFallback.generic),
      exportStack: stackOf([face.familyName, ...project.typography.customFallback.families], project.typography.customFallback.generic),
      license: face.license,
      source: null,
    }
  }
  const src = project.fontSources.find((s) => s.id === font.sourceId)
  if (!src) return { origin: 'broken', family: 'Font (removed)', previewStack: 'inherit', exportStack: 'inherit', license: null, source: null }
  const stack = stackOf([src.family, ...src.fallbackFamilies], src.fallback)
  return {
    origin: src.kind,
    family: src.family,
    previewStack: stack,
    exportStack: stack,
    license: src.license,
    source: src,
  }
}

export const resolveRole = (project: Pick<Project, 'fontSources' | 'customTypeface' | 'typography'>, role: TypographyRole): ResolvedFont => resolveFont(project, role.font)

export interface FontUse {
  key: string
  font: ResolvedFont
  roles: TypographyRole[]
}

/** Each distinct font the roles use, with the roles that use it. Order follows the roles. */
export function fontsInUse(project: Pick<Project, 'fontSources' | 'customTypeface' | 'typography'>): FontUse[] {
  const uses = new Map<string, FontUse>()
  for (const role of project.typography.roles) {
    if (!role.font) continue
    const font = resolveFont(project, role.font)
    const key = role.font.kind === 'custom' ? `custom:${role.font.typefaceId}` : `source:${role.font.sourceId}`
    const use = uses.get(key) ?? { key, font, roles: [] }
    use.roles.push(role)
    uses.set(key, use)
  }
  return [...uses.values()]
}

/** Roles that use the project's own typeface. */
export const rolesUsingCustom = (project: Pick<Project, 'typography' | 'customTypeface'>): TypographyRole[] =>
  project.typography.roles.filter((r) => r.font?.kind === 'custom' && r.font.typefaceId === project.customTypeface?.id)

/** A CSS-safe slug for each role, unique within the project (two roles named alike get -2, -3…). */
export function roleSlugs(roles: readonly TypographyRole[]): Map<string, string> {
  const out = new Map<string, string>()
  const used = new Set<string>()
  for (const r of roles) {
    const base = slug(r.name, r.kind)
    let candidate = base
    for (let n = 2; used.has(candidate); n++) candidate = `${base}-${n}`
    used.add(candidate)
    out.set(r.id, candidate)
  }
  return out
}
