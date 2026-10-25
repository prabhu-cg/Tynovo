import type { Geo } from '../geo'
import type { Shape } from '../geometry/shapes'

/**
 * How a glyph edge should be spaced. Straight stems take the full sidebearing, round edges a little less,
 * diagonals and open edges (T, V, 7) much less so the gaps look even.
 */
export type SpacingClass = 'straight' | 'round' | 'diagonal' | 'open'

export interface GlyphSpec {
  /** Builds the glyph's ink from construction primitives. Pure and deterministic. */
  build: (g: Geo) => Shape
  left: SpacingClass
  right: SpacingClass
}

export type SpecTable = Record<string, GlyphSpec>

export const spec = (build: GlyphSpec['build'], left: SpacingClass = 'straight', right: SpacingClass = left): GlyphSpec => ({ build, left, right })
