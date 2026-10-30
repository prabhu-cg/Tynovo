import type { Contour } from '../brand-projects/schema'
import { contoursBounds, controlBounds } from '../glyph-editor/geometry'
import type { FontFormatId } from './formats'

/**
 * The left side bearing the font file must record for a glyph. hmtx has to say where the glyph's ink starts, or
 * renderers disagree about where it is drawn (see the note in fontFluxBuilder).
 *  - TrueType: the glyph header records the box around every point, control points included, and FreeType places
 *    the glyph by that header, so hmtx carries the same number.
 *  - OpenType/CFF: there is no header; the bearing is where the ink starts, measured on the curve.
 * The two agree for straight-edged glyphs. They differ only when a control point sticks out past the curve.
 */
export function fileLeftSideBearing(contours: Contour[], format: FontFormatId): number {
  if (format === 'otf') return Math.round(contoursBounds(contours)?.minX ?? 0)
  return controlBounds(contours)?.minX ?? 0
}
