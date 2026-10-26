import type { Brand, RoleKind } from '@/modules/brand-projects/schema'
import { CATALOG, type CatalogFont } from './catalog'

/**
 * Suggestions are a transparent scoring of Tynovo's own tags and the font packages' metadata against the brand
 * direction. They are fixed rules, not a model, and they say nothing about accessibility or quality: every point
 * is shown with its reason so the reasoning can be checked and disagreed with.
 */
export const RECOMMENDATION_NOTE =
  'Suggestions come from fixed rules that compare Tynovo’s own tags (our judgement) and each font’s weights and styles with the tone, use cases and priorities you set. They are not an AI model and not a legibility or accessibility test.'

export interface Reason {
  text: string
  points: number
}

export interface Suggestion {
  font: CatalogFont
  score: number
  reasons: Reason[]
}

type BrandInput = Pick<Brand, 'tones' | 'useCases' | 'readabilityPriority' | 'displayPriority'>

/** Suggestions need at least a tone or a use case to say anything. */
export const hasBrandSignals = (b: Pick<Brand, 'tones' | 'useCases'>) => b.tones.length > 0 || b.useCases.length > 0

const TEXT_KINDS: readonly RoleKind[] = ['body', 'ui', 'caption']
const LARGE_KINDS: readonly RoleKind[] = ['display', 'heading']

export function scoreFont(font: CatalogFont, brand: BrandInput, kind: RoleKind): Suggestion {
  const reasons: Reason[] = []
  const add = (text: string, points: number) => reasons.push({ text, points })
  for (const tone of brand.tones) if (font.tags.tones.includes(tone)) add(`Tagged for a ${tone} tone`, 2)
  for (const use of brand.useCases) if (font.tags.uses.includes(use)) add(`Tagged for ${use === 'saas' ? 'SaaS' : use} use`, 1)

  if (TEXT_KINDS.includes(kind)) {
    const p = brand.readabilityPriority
    if (font.tags.text) {
      if (p >= 4) add('Tagged as drawn for text sizes, and readability is a high priority', 2)
      else if (p === 3) add('Tagged as drawn for text sizes', 1)
    } else if (p >= 4) add('Not tagged as drawn for text sizes, and readability is a high priority', -3)
    else if (p === 3) add('Not tagged as drawn for text sizes', -1)
    if (font.category === 'display' || font.category === 'handwriting') add(`${font.category === 'display' ? 'Display' : 'Handwriting'} designs are not made for long text`, -3)
    if (font.category === 'monospace' && kind === 'body') add('Monospace is tiring for long text', -2)
    const bold = font.weights.includes(400) && (font.weights.includes(600) || font.weights.includes(700))
    if (bold && kind === 'body') add('Has regular and bold weights for emphasis', 1)
    if (brand.useCases.includes('editorial') && font.italic && kind === 'body') add('Has a regular italic, which editorial text uses for emphasis', 1)
  }
  if (LARGE_KINDS.includes(kind)) {
    const p = brand.displayPriority
    if (font.tags.display) {
      if (p >= 4) add('Tagged for large sizes, and display use is a high priority', 2)
      else if (p === 3) add('Tagged for large sizes', 1)
    } else if (kind === 'display' && p >= 4) add('Not tagged for large sizes, and display use is a high priority', -1)
    if (font.weights.length >= 3) add(`Offers ${font.weights.length} weights`, 1)
  }
  return { font, score: reasons.reduce((n, r) => n + r.points, 0), reasons }
}

/** Designs not made for long or small text are never suggested for it, whatever else they match. */
export function eligible(font: CatalogFont, kind: RoleKind): boolean {
  if (kind === 'body') return !['display', 'handwriting', 'monospace'].includes(font.category)
  if (kind === 'ui' || kind === 'caption') return !['display', 'handwriting'].includes(font.category)
  return true
}

/** Fonts that score above zero for a role, best first. Empty until the brand has a tone or a use case. */
export function suggestFonts(brand: BrandInput, kind: RoleKind, limit = 5): Suggestion[] {
  if (!hasBrandSignals(brand)) return []
  return CATALOG.filter((f) => eligible(f, kind))
    .map((f) => scoreFont(f, brand, kind))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.font.family.localeCompare(b.font.family))
    .slice(0, limit)
}

export interface PairSuggestion {
  primary: Suggestion
  secondary: Suggestion
  score: number
  /** Reasons that concern the two fonts together. The fonts' own reasons are on `primary` and `secondary`. */
  together: Reason[]
}

const isSans = (f: CatalogFont) => f.category === 'sans-serif'

/** A few pairings: a heading/display font and a text font that suit the brand, with what they do together. */
export function suggestPairings(brand: BrandInput, limit = 3): PairSuggestion[] {
  if (!hasBrandSignals(brand)) return []
  const primaries = suggestFonts(brand, 'heading', 8)
  const secondaries = suggestFonts(brand, 'body', 8)
  const bestPerPrimary = new Map<string, PairSuggestion>()
  for (const p of primaries) {
    for (const s of secondaries) {
      if (p.font.id === s.font.id) continue
      const together: Reason[] = []
      if ((isSans(p.font) && s.font.category === 'serif') || (p.font.category === 'serif' && isSans(s.font))) together.push({ text: 'A serif with a sans serif: the two structures make the roles easy to tell apart', points: 1 })
      if (p.font.tags.superfamily && p.font.tags.superfamily === s.font.tags.superfamily) together.push({ text: 'Designed as one family, so the proportions agree', points: 1 })
      if (p.font.category === 'monospace' && s.font.category === 'monospace') together.push({ text: 'Two monospace fonts are hard to tell apart', points: -2 })
      const score = p.score + s.score + together.reduce((n, r) => n + r.points, 0)
      const prev = bestPerPrimary.get(p.font.id)
      if (!prev || score > prev.score) bestPerPrimary.set(p.font.id, { primary: p, secondary: s, score, together })
    }
  }
  return [...bestPerPrimary.values()].sort((a, b) => b.score - a.score || a.primary.font.family.localeCompare(b.primary.font.family)).slice(0, limit)
}

/* ---------- catalog search and filters ---------- */

export interface CatalogFilter {
  query: string
  categories: readonly CatalogFont['category'][]
  tones: readonly string[]
  uses: readonly string[]
  /** Only fonts tagged as drawn for text. */
  text: boolean
  /** Only fonts tagged for large sizes. */
  display: boolean
}

export const NO_FILTER: CatalogFilter = { query: '', categories: [], tones: [], uses: [], text: false, display: false }

/** Search by family name, then every active filter must hold. Within a filter group a font may match any value. */
export function filterCatalog(filter: CatalogFilter, fonts: readonly CatalogFont[] = CATALOG): CatalogFont[] {
  const q = filter.query.trim().toLowerCase()
  return fonts.filter(
    (f) =>
      (q === '' || f.family.toLowerCase().includes(q)) &&
      (filter.categories.length === 0 || filter.categories.includes(f.category)) &&
      (filter.tones.length === 0 || filter.tones.some((t) => (f.tags.tones as readonly string[]).includes(t))) &&
      (filter.uses.length === 0 || filter.uses.some((u) => (f.tags.uses as readonly string[]).includes(u))) &&
      (!filter.text || f.tags.text) &&
      (!filter.display || f.tags.display),
  )
}
