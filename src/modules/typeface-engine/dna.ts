import { dnaSchema, type Dna, type FontMetrics, type GlyphParams } from '../brand-projects/schema.js'

export type Family = Dna['family']

export const FAMILY_LABELS: Record<Family, { name: string; blurb: string }> = {
  geometric: { name: 'Geometric', blurb: 'True circles and ellipses, straight sharp-cut strokes.' },
  rounded: { name: 'Rounded geometric', blurb: 'Soft rounded-rectangle bowls and round terminals.' },
  modular: { name: 'Modular', blurb: 'Rectilinear forms on a grid with chamfered corners.' },
}

const base: Dna = {
  family: 'geometric',
  capHeight: 700,
  xHeightRatio: 0.72,
  ascenderRise: 30,
  descenderDepth: 200,
  widthScale: 1,
  strokeThickness: 90,
  contrast: 1,
  roundness: 1,
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

/** Starting point for each family. These are presets for the same parameters, not separate code paths for the user. */
export function defaultDna(family: Family = 'geometric'): Dna {
  switch (family) {
    case 'geometric':
      return { ...base }
    case 'rounded':
      return { ...base, family, strokeThickness: 100, roundness: 0.7, overshoot: 10, cornerStyle: 'round', cornerRadius: 50, innerCornerRatio: 0.5, terminal: 'round', aperture: 0.34, sidebearing: 66 }
    case 'modular':
      return { ...base, family, strokeThickness: 100, roundness: 0, overshoot: 0, grid: 50, cornerStyle: 'chamfer', cornerRadius: 50, innerCornerRatio: 0.5, terminal: 'flat', widthScale: 0.95, sidebearing: 70 }
  }
}

export function validateDnaShape(input: unknown): { ok: true; dna: Dna } | { ok: false; message: string } {
  const r = dnaSchema.safeParse(input)
  if (r.success) return { ok: true, dna: r.data }
  const first = r.error.issues[0]
  return { ok: false, message: `${first?.path.join('.') || 'dna'}: ${first?.message ?? 'invalid'}` }
}

/* ---------- metrics ---------- */

export const UNITS_PER_EM = 1000

/** Vertical metrics implied by the DNA. Every glyph is generated inside these. */
export function deriveMetrics(dna: Dna): FontMetrics {
  return {
    unitsPerEm: UNITS_PER_EM,
    ascender: dna.capHeight + dna.ascenderRise + dna.overshoot,
    descender: -(dna.descenderDepth + dna.overshoot),
    lineGap: 0,
    capHeight: dna.capHeight,
    xHeight: Math.round(dna.capHeight * dna.xHeightRatio),
  }
}

/* ---------- effective parameters ---------- */

export interface Strokes {
  sv: number
  sh: number
  /** True when the requested thickness had to be reduced to keep counters open. */
  clamped: boolean
}

const snapTo = (v: number, grid: number) => (grid > 0 ? Math.round(v / grid) * grid : Math.round(v))
/** Strokes never snap to zero: at least one grid unit. */
const snapStroke = (v: number, grid: number) => (grid > 0 ? Math.max(grid, snapTo(v, grid)) : Math.round(v))

/**
 * Stroke thicknesses actually used. A stroke is limited so that three horizontal strokes still fit
 * in the x-height with room between them, and vertical strokes leave counters open.
 */
export function effectiveStrokes(dna: Dna, params?: GlyphParams): Strokes {
  const wantV = params?.strokeThickness ?? dna.strokeThickness
  const wantH = wantV * (params?.contrast ?? dna.contrast)
  const xHeight = Math.round(dna.capHeight * dna.xHeightRatio)
  const maxH = Math.floor(xHeight / 4.2)
  const maxV = Math.floor(dna.capHeight * 0.22)
  const limit = (v: number, max: number) => Math.min(v, max)
  let sv = snapStroke(limit(wantV, maxV), dna.grid)
  let sh = snapStroke(limit(wantH, maxH), dna.grid)
  // Snapping up can overshoot the limit; step down one grid unit instead.
  if (dna.grid > 0) {
    if (sv > maxV && sv - dna.grid >= dna.grid) sv -= dna.grid
    if (sh > maxH && sh - dna.grid >= dna.grid) sh -= dna.grid
  }
  sv = Math.max(sv, 12)
  sh = Math.max(sh, 12)
  return { sv, sh, clamped: sv < Math.round(wantV) - 0.5 || sh < Math.round(wantH) - 0.5 }
}

/** Global DNA with one glyph's parameter overrides applied. */
export function withGlyphParams(dna: Dna, params?: GlyphParams): Dna {
  if (!params) return dna
  const out = { ...dna }
  if (params.widthScale !== undefined) out.widthScale = params.widthScale
  if (params.strokeThickness !== undefined) out.strokeThickness = params.strokeThickness
  if (params.contrast !== undefined) out.contrast = params.contrast
  if (params.roundness !== undefined) out.roundness = params.roundness
  if (params.cornerRadius !== undefined) out.cornerRadius = params.cornerRadius
  return out
}

/** A rounded or chamfered corner may be at most this many times the stroke thickness. */
export const MAX_CORNER_PER_STROKE = 1.1

export interface DnaIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
}

/** Relationship checks that the per-field ranges cannot express. */
export function dnaIssues(dna: Dna): DnaIssue[] {
  const issues: DnaIssue[] = []
  const m = deriveMetrics(dna)
  if (m.ascender < m.capHeight) issues.push({ severity: 'error', code: 'dna.ascender', message: 'Ascender must not be below the cap height.' })
  if (m.xHeight >= m.capHeight) issues.push({ severity: 'error', code: 'dna.x-height', message: 'x-height must be below the cap height.' })
  if (m.descender >= 0) issues.push({ severity: 'error', code: 'dna.descender', message: 'Descender must be below the baseline.' })
  if (m.ascender - m.descender > UNITS_PER_EM * 1.6) issues.push({ severity: 'warning', code: 'dna.line-height', message: 'Ascender plus descender is very tall for a 1000-unit em; line spacing will be loose.' })
  const strokes = effectiveStrokes(dna)
  if (strokes.clamped) issues.push({ severity: 'warning', code: 'dna.stroke-clamped', message: `Stroke thickness is limited to keep counters open (using ${strokes.sv} vertical, ${strokes.sh} horizontal).` })
  const cornerLimit = Math.round(Math.min(strokes.sv, strokes.sh) * MAX_CORNER_PER_STROKE)
  if (dna.cornerStyle !== 'sharp' && dna.cornerRadius > cornerLimit) issues.push({ severity: 'warning', code: 'dna.corner-limited', message: `Corner size is limited to ${cornerLimit} by the stroke thickness so joints are never cut through.` })
  if (dna.cornerStyle === 'sharp' && dna.cornerRadius > 0) issues.push({ severity: 'warning', code: 'dna.corner-unused', message: 'Corner radius has no effect while the corner style is sharp.' })
  if (dna.grid > 0 && dna.capHeight % dna.grid !== 0) issues.push({ severity: 'warning', code: 'dna.grid-cap', message: `Cap height ${dna.capHeight} is not a multiple of the ${dna.grid} grid; horizontals will not meet the grid exactly.` })
  if (dna.family === 'modular' && dna.roundness > 0.3) issues.push({ severity: 'warning', code: 'dna.modular-round', message: 'Modular family normally uses roundness near 0; high values give curved bowls.' })
  return issues
}

/** Controls for building a parameter UI. Ranges must match dnaSchema (checked in tests). */
export interface DnaControl {
  key: Exclude<keyof Dna, 'family' | 'cornerStyle' | 'terminal'>
  label: string
  group: 'Proportions' | 'Strokes' | 'Construction' | 'Corners' | 'Spacing'
  min: number
  max: number
  step: number
  hint?: string
}

export const DNA_CONTROLS: readonly DnaControl[] = [
  { key: 'capHeight', label: 'Cap height', group: 'Proportions', min: 500, max: 900, step: 10 },
  { key: 'xHeightRatio', label: 'x-height ratio', group: 'Proportions', min: 0.5, max: 0.9, step: 0.01 },
  { key: 'ascenderRise', label: 'Ascender rise', group: 'Proportions', min: 0, max: 150, step: 5 },
  { key: 'descenderDepth', label: 'Descender depth', group: 'Proportions', min: 100, max: 350, step: 10 },
  { key: 'widthScale', label: 'Width', group: 'Proportions', min: 0.6, max: 1.6, step: 0.02 },
  { key: 'strokeThickness', label: 'Stroke thickness', group: 'Strokes', min: 30, max: 200, step: 2 },
  { key: 'contrast', label: 'Contrast (horizontal / vertical)', group: 'Strokes', min: 0.5, max: 1.3, step: 0.02 },
  { key: 'roundness', label: 'Roundness', group: 'Construction', min: 0, max: 1, step: 0.05, hint: '1 = circles, 0 = squares' },
  { key: 'overshoot', label: 'Overshoot', group: 'Construction', min: 0, max: 40, step: 1 },
  { key: 'crossbarPosition', label: 'Crossbar height', group: 'Construction', min: 0.35, max: 0.65, step: 0.01 },
  { key: 'aperture', label: 'Aperture', group: 'Construction', min: 0.15, max: 0.6, step: 0.01 },
  { key: 'grid', label: 'Grid (0 = off)', group: 'Construction', min: 0, max: 100, step: 10, hint: 'Snaps strokes and key coordinates' },
  { key: 'cornerRadius', label: 'Corner size', group: 'Corners', min: 0, max: 150, step: 2 },
  { key: 'innerCornerRatio', label: 'Inside corners', group: 'Corners', min: 0, max: 1, step: 0.05 },
  { key: 'sidebearing', label: 'Sidebearing', group: 'Spacing', min: 10, max: 200, step: 2 },
  { key: 'sidebearingBalance', label: 'Balance', group: 'Spacing', min: -0.5, max: 0.5, step: 0.05 },
  { key: 'tracking', label: 'Tracking', group: 'Spacing', min: -100, max: 200, step: 2 },
  { key: 'spaceWidth', label: 'Space width', group: 'Spacing', min: 100, max: 600, step: 10 },
]
