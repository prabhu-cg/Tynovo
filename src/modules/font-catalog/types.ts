export type FontCategory = 'sans-serif' | 'serif' | 'monospace' | 'display' | 'handwriting'

/** One catalogued font, as generated from its distribution's own metadata (see scripts/build-catalog.mjs). */
export interface CatalogEntry {
  id: string
  family: string
  category: FontCategory
  /** Upright weights the studio bundles (Latin subset). */
  weights: number[]
  /** Styles the family has upstream. Only regular italic is bundled, see `italic`. */
  styles: ('normal' | 'italic')[]
  /** True when a regular italic is bundled. */
  italic: boolean
  license: { spdx: string; url: string; copyright: string }
  /** Upstream version as reported by the distribution's metadata. */
  version: string
  /** Where the authors publish the family, per the distribution's metadata. */
  upstream: string
  /** npm package the files come from, and its version. */
  distribution: string
  distributionVersion: string
  /** The distribution's own page for the font. */
  page: string
}
