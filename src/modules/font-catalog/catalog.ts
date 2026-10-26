import type { FontSource, License } from '@/modules/brand-projects/schema'
import { CATALOG_DATA } from './catalog.data'
import { TAGS, type FontTags } from './tags'
import type { CatalogEntry, FontCategory } from './types'

export type { CatalogEntry, FontCategory } from './types'
export type { FontTags } from './tags'

/**
 * Existing fonts that ship inside the studio, so previews are drawn with the real font.
 * Every one is distributed by its authors under the SIL Open Font License 1.1, which allows use and
 * redistribution (the font may not be sold on its own). Facts (category, weights, styles, licence, version,
 * source) are generated from each font package's own metadata; `tags` are the studio's judgement and say so.
 *
 * Exports never include these files. They name the font and say where to get it (see export-centre).
 */
export interface CatalogFont extends CatalogEntry {
  tags: FontTags
  /** Generic family a stack ends with. */
  fallback: FontSource['fallback']
}

export const CATEGORY_LABEL: Record<FontCategory, string> = {
  'sans-serif': 'Sans serif',
  serif: 'Serif',
  monospace: 'Monospace',
  display: 'Display',
  handwriting: 'Handwriting',
}
export const CATEGORIES = Object.keys(CATEGORY_LABEL) as FontCategory[]

const FALLBACK_FOR: Record<FontCategory, FontSource['fallback']> = {
  'sans-serif': 'sans-serif',
  serif: 'serif',
  monospace: 'monospace',
  display: 'serif',
  handwriting: 'cursive',
}

export const CATALOG: readonly CatalogFont[] = CATALOG_DATA.map((e) => {
  const tags = TAGS[e.id]
  if (!tags) throw new Error(`Font "${e.id}" has no editorial tags (src/modules/font-catalog/tags.ts)`)
  return { ...e, tags, fallback: FALLBACK_FOR[e.category] }
})

export const catalogFontFor = (family: string): CatalogFont | undefined =>
  CATALOG.find((c) => c.family.toLowerCase() === family.trim().toLowerCase())

export const catalogFontById = (id: string): CatalogFont | undefined => CATALOG.find((c) => c.id === id)

/** What the project records as the licence of a catalog font. */
export const catalogLicense = (font: CatalogFont): License => ({ name: 'SIL Open Font License 1.1', spdx: font.license.spdx, url: font.license.url, verified: true })

/** A project font entry for a catalog font. The caller supplies the id. */
export function sourceFromCatalog(font: CatalogFont, id: string): FontSource {
  return { id, family: font.family, kind: 'catalog', license: catalogLicense(font), weights: [...font.weights], fallback: font.fallback, fallbackFamilies: [] }
}

/** Placeholder licence for a font the user names. The studio cannot know it, so it says so. */
export const UNKNOWN_LICENSE: License = { name: 'Not recorded', verified: false }

/** A font installed on the viewer's device (or supplied separately), named by the user. */
export function sourceFromName(family: string, fallback: FontSource['fallback'], id: string): FontSource {
  return { id, family: family.trim().slice(0, 200), kind: 'system', license: { ...UNKNOWN_LICENSE }, weights: [], fallback, fallbackFamilies: [] }
}
