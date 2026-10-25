import type { Contour, CustomTypeface, Dna, Glyph, GlyphOverride } from '../brand-projects/schema'
import { glyphName, TARGET_CHARS } from './charset'
import { effectiveStrokes, MAX_CORNER_PER_STROKE, withGlyphParams } from './dna'
import { makeGeo } from './geo'
import { shapeToContours } from './geometry/clean'
import { bounds, mapPoints, toWholeUnits, type Shape } from './geometry/shapes'
import { soften } from './geometry/soften'
import { SPECS } from './glyphs'
import type { SpacingClass } from './glyphs/types'
import { ENGINE_VERSION } from './version'

/** Fraction of the sidebearing used for each edge class. */
const BEARING_FACTOR: Record<SpacingClass, number> = { straight: 1, round: 0.72, diagonal: 0.22, open: 0.4 }

export function bearing(dna: Dna, cls: SpacingClass, side: 'left' | 'right'): number {
  const balance = side === 'left' ? 1 + dna.sidebearingBalance : 1 - dna.sidebearingBalance
  return Math.round(dna.sidebearing * BEARING_FACTOR[cls] * balance)
}

export type GenerateOutcome =
  | { ok: true; glyph: Glyph }
  | { ok: false; reason: 'no-recipe' | 'failed' | 'empty'; message: string }

const snapCorner = (dna: Dna, v: number) => (dna.grid > 0 ? Math.max(0, Math.round(v / dna.grid) * dna.grid) : Math.round(v))

/** Corner softening for one glyph, limited by the stroke so a joint can never be cut through. */
function softenShape(shape: Shape, dna: Dna, sv: number, sh: number): Shape {
  if (dna.cornerStyle === 'sharp' || dna.cornerRadius <= 0) return shape
  const limit = Math.round(Math.min(sv, sh) * MAX_CORNER_PER_STROKE)
  const outside = Math.min(snapCorner(dna, dna.cornerRadius), limit)
  const inside = Math.min(snapCorner(dna, dna.cornerRadius * dna.innerCornerRatio), limit)
  return soften(shape, { kind: dna.cornerStyle === 'chamfer' ? 'chamfer' : 'round', outside, inside })
}

/** Frozen-outline glyph: geometry comes from the override, spacing from the override or the DNA defaults. */
function fromFrozen(dna: Dna, char: string, contours: Contour[], o: GlyphOverride, rsbClass: SpacingClass): Glyph {
  const maxX = contours.reduce((m, c) => c.reduce((mm, p) => Math.max(mm, p.x), m), -Infinity)
  const advance = o.advanceWidth ?? Math.max(0, Math.round(maxX + (o.rightBearing ?? bearing(dna, rsbClass, 'right')) + dna.tracking))
  return { char, name: glyphName(char), advanceWidth: advance, contours }
}

/** Generate one glyph. Deterministic: the same DNA, character and override always give the same result. */
export function generateGlyph(dna: Dna, char: string, override?: GlyphOverride): GenerateOutcome {
  if (char === ' ') return { ok: true, glyph: { char, name: glyphName(char), advanceWidth: dna.spaceWidth, contours: [] } }
  const spec = SPECS[char]
  if (override?.contours) {
    return { ok: true, glyph: fromFrozen(dna, char, override.contours, override, spec?.right ?? 'straight') }
  }
  if (!spec) return { ok: false, reason: 'no-recipe', message: `No recipe for ${JSON.stringify(char)} yet.` }
  try {
    const geo = makeGeo(dna, override?.params)
    const eff = geo.dna
    let shape = spec.build(geo)
    shape = softenShape(shape, eff, geo.sv, geo.sh)
    const b = bounds(shape)
    if (!b) return { ok: false, reason: 'empty', message: `Recipe for ${JSON.stringify(char)} produced no outline.` }
    const lsb = override?.leftBearing ?? bearing(eff, spec.left, 'left')
    const rsb = override?.rightBearing ?? bearing(eff, spec.right, 'right')
    const placed = mapPoints(shape, ([x, y]) => [x - b.minX + lsb, y])
    const contours = shapeToContours(toWholeUnits(placed))
    if (contours.length === 0) return { ok: false, reason: 'empty', message: `Outline for ${JSON.stringify(char)} vanished when rounded to whole units.` }
    const inkWidth = b.maxX - b.minX
    // Negative tracking tightens spacing but never pulls a glyph's own ink past its advance.
    const advance = override?.advanceWidth ?? Math.max(Math.round(lsb + inkWidth), Math.round(lsb + inkWidth + rsb + eff.tracking))
    return { ok: true, glyph: { char, name: glyphName(char), advanceWidth: advance, contours } }
  } catch (e) {
    return { ok: false, reason: 'failed', message: `Could not build ${JSON.stringify(char)}: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/* ---------- whole typeface ---------- */

export interface GeneratedTypeface {
  /** Glyphs that were generated (supported or not yet validated: validation is separate). */
  glyphs: Glyph[]
  /** Target characters with no glyph, with the reason. */
  missing: Array<{ char: string; reason: 'no-recipe' | 'failed' | 'empty'; message: string }>
  engineVersion: number
}

const cache = new Map<string, GenerateOutcome>()
const CACHE_LIMIT = 4000

function cached(dna: Dna, char: string, o: GlyphOverride | undefined): GenerateOutcome {
  // Only inputs that affect this glyph go in the key, so unrelated edits reuse results.
  const key = `${ENGINE_VERSION}|${JSON.stringify(dna)}|${char}|${o ? JSON.stringify(o) : ''}`
  const hit = cache.get(key)
  if (hit) return hit
  const out = generateGlyph(dna, char, o)
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(key, out)
  return out
}

export function clearGeneratorCache() {
  cache.clear()
}

export function generateTypeface(face: Pick<CustomTypeface, 'dna' | 'overrides'>, chars: readonly string[] = TARGET_CHARS): GeneratedTypeface {
  const glyphs: Glyph[] = []
  const missing: GeneratedTypeface['missing'] = []
  for (const char of chars) {
    const out = cached(face.dna, char, face.overrides[char])
    if (out.ok) glyphs.push(out.glyph)
    else missing.push({ char, reason: out.reason, message: out.message })
  }
  return { glyphs, missing, engineVersion: ENGINE_VERSION }
}

export { effectiveStrokes, withGlyphParams }
