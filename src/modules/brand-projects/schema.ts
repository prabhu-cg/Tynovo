import { z } from 'zod'

/**
 * Shared, versioned project model. Pure data + validation; no React, no storage.
 * Bump CURRENT_SCHEMA_VERSION and register a step in migrations.ts for any
 * change that old data cannot satisfy.
 */
export const CURRENT_SCHEMA_VERSION = 4

const isoDate = z.iso.datetime()
const id = z.string().min(1).max(64)

/* ---------- Licences and font sources ---------- */

/** Licence of a font or asset. `verified` is true only when a person confirmed it. */
export const licenseSchema = z.object({
  name: z.string().max(200),
  spdx: z.string().max(100).optional(),
  url: z.url().optional(),
  verified: z.boolean(),
})
export type License = z.infer<typeof licenseSchema>

/** Where a CSS stack falls back to when a font is not available. */
export const FALLBACK_STACKS = ['sans-serif', 'serif', 'monospace', 'system-ui', 'cursive'] as const

/**
 * An existing font (made by someone else) that the project uses. The project's own generated typeface is NOT a
 * font source: it lives in `customTypeface` only, and roles link to it by id, so nothing is stored twice.
 */
export const fontSourceSchema = z.object({
  id,
  family: z.string().min(1).max(200),
  /** catalog: bundled with Tynovo. system: a family installed on the viewer's device, named by the user. uploaded: reserved. */
  kind: z.enum(['catalog', 'system', 'uploaded']),
  /** Licence of the font itself. Never inferred from the app or from libraries used to build it. */
  license: licenseSchema,
  /** Variable-font axes or static weights that the project has chosen to use. */
  weights: z.array(z.number().int().min(1).max(1000)).max(20),
  /** Generic family the CSS stack ends with. */
  fallback: z.enum(FALLBACK_STACKS),
  /** Families tried after this font and before the generic one, e.g. "Helvetica Neue", "Arial". */
  fallbackFamilies: z.array(z.string().trim().min(1).max(200)).max(8),
})
export type FontSource = z.infer<typeof fontSourceSchema>

/* ---------- Typography system ---------- */

export const ROLE_KINDS = ['display', 'heading', 'body', 'ui', 'caption'] as const
export type RoleKind = (typeof ROLE_KINDS)[number]

/**
 * Which font a role uses. The two shapes are different on purpose, so an existing font and the project's
 * own typeface can never be mistaken for one another.
 */
export const roleFontSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('source'), sourceId: id }),
  z.object({ kind: z.literal('custom'), typefaceId: id }),
])
export type RoleFont = z.infer<typeof roleFontSchema>

export const typographyRoleSchema = z.object({
  id,
  /** Display name, e.g. "Heading". */
  name: z.string().min(1).max(60),
  /** What the role is for. Decides which characters and readability a custom typeface must satisfy. */
  kind: z.enum(ROLE_KINDS),
  font: roleFontSchema.nullable(),
  weight: z.number().int().min(1).max(1000),
  /** Index into the type scale (0 = base). Negative steps are smaller. */
  scaleStep: z.number().int().min(-6).max(12),
  lineHeight: z.number().min(0.8).max(3),
  letterSpacingEm: z.number().min(-0.2).max(0.5),
})
export type TypographyRole = z.infer<typeof typographyRoleSchema>

export const typeScaleSchema = z.object({
  baseSizePx: z.number().min(8).max(64),
  ratio: z.number().min(1).max(3),
  stepsDown: z.number().int().min(0).max(6),
  stepsUp: z.number().int().min(0).max(12),
})
export type TypeScale = z.infer<typeof typeScaleSchema>

/* ---------- Custom typeface ---------- */

export const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  /** TrueType semantics: off-curve points are quadratic control points. */
  onCurve: z.boolean(),
})
export type Point = z.infer<typeof pointSchema>

/** A closed contour. Outer contours run clockwise, counters counter-clockwise (TrueType). */
export const contourSchema = z.array(pointSchema).min(3).max(4000)
export type Contour = z.infer<typeof contourSchema>

export const glyphSchema = z.object({
  /** Single Unicode character this glyph encodes. */
  char: z.string().refine((s) => [...s].length === 1, 'must be a single character'),
  /** Glyph name used inside the font (ASCII, no spaces). */
  name: z.string().regex(/^[A-Za-z_.][A-Za-z0-9_.]{0,62}$/),
  advanceWidth: z.number().int().min(0).max(4000),
  contours: z.array(contourSchema).max(32),
})
export type Glyph = z.infer<typeof glyphSchema>

/* ---------- Design DNA (typeface engine input) ---------- */

export const FAMILIES = ['geometric', 'rounded', 'modular'] as const
export const CORNER_STYLES = ['sharp', 'round', 'chamfer'] as const
export const TERMINALS = ['flat', 'angled', 'round'] as const

const range = (min: number, max: number) => z.number().finite().min(min).max(max)
const intRange = (min: number, max: number) => z.number().int().min(min).max(max)

/**
 * Everything the generator needs. All units are font units at 1000 units per em.
 * Identical DNA + engine version always produces identical glyphs.
 */
export const dnaSchema = z.object({
  family: z.enum(FAMILIES),
  /* proportions and metrics */
  capHeight: intRange(500, 900),
  /** x-height as a fraction of cap height. */
  xHeightRatio: range(0.5, 0.9),
  /** How far ascenders (b d f h k l) rise above the cap height. */
  ascenderRise: intRange(0, 150),
  descenderDepth: intRange(100, 350),
  /** Multiplies every glyph's design width. */
  widthScale: range(0.6, 1.6),
  /* strokes */
  /** Thickness of vertical strokes. */
  strokeThickness: intRange(30, 200),
  /** Horizontal stroke thickness as a multiple of vertical (1 = monoline). */
  contrast: range(0.5, 1.3),
  /* construction */
  /** 1 = true ellipses, 0 = rectangles. Modular family cuts corners (chamfers) by the same fraction. */
  roundness: range(0, 1),
  /** Round glyphs extend past baseline and cap height by this much (vertical alignment). */
  overshoot: intRange(0, 40),
  /** Height of horizontal crossbars as a fraction of the letter's height (E, A, H, e...). */
  crossbarPosition: range(0.35, 0.65),
  /** Snap construction coordinates to this grid. 0 turns the grid off. */
  grid: intRange(0, 100).refine((g) => g === 0 || g >= 10, 'Grid must be 0 (off) or at least 10'),
  /* corners and terminals */
  cornerStyle: z.enum(CORNER_STYLES),
  cornerRadius: intRange(0, 150),
  /** Inside (concave) corner softening as a fraction of the outside radius. */
  innerCornerRatio: range(0, 1),
  terminal: z.enum(TERMINALS),
  /** Opening of C, G, e, c... as a fraction of the letter height. */
  aperture: range(0.15, 0.6),
  /* spacing */
  sidebearing: intRange(10, 200),
  /** Shifts ink inside the advance: -0.5 pushes left, +0.5 pushes right (horizontal alignment). */
  sidebearingBalance: range(-0.5, 0.5),
  tracking: intRange(-100, 200),
  spaceWidth: intRange(100, 600),
})
export type Dna = z.infer<typeof dnaSchema>

/** The subset of DNA that a single glyph may override. Overrides follow all other global changes. */
export const glyphParamsSchema = z
  .object({
    widthScale: range(0.4, 2.2),
    strokeThickness: intRange(20, 240),
    contrast: range(0.4, 1.5),
    roundness: range(0, 1),
    cornerRadius: intRange(0, 200),
  })
  .partial()
  .strict()
export type GlyphParams = z.infer<typeof glyphParamsSchema>

/** Per-glyph refinements. They survive global edits and project reloads until explicitly reset. */
export const glyphOverrideSchema = z.object({
  /** Replace the computed advance width. */
  advanceWidth: intRange(0, 4000).optional(),
  /** Replace the computed left / right side bearing. */
  leftBearing: intRange(-300, 600).optional(),
  rightBearing: intRange(-300, 600).optional(),
  /** Per-glyph DNA parameters; unset keys follow the global DNA. */
  params: glyphParamsSchema.optional(),
  /** A frozen outline. When present it replaces generated geometry, so global shape changes no longer apply. */
  contours: z.array(contourSchema).max(32).optional(),
})
export type GlyphOverride = z.infer<typeof glyphOverrideSchema>

export const fontMetricsSchema = z.object({
  unitsPerEm: z.number().int().min(16).max(16384),
  ascender: z.number().int(),
  descender: z.number().int().max(0),
  lineGap: z.number().int().min(0),
  capHeight: z.number().int().min(0),
  xHeight: z.number().int().min(0),
})
export type FontMetrics = z.infer<typeof fontMetricsSchema>

export const kerningPairSchema = z.object({
  left: z.string(),
  right: z.string(),
  value: z.number().int().min(-2000).max(2000),
})
export type KerningPair = z.infer<typeof kerningPairSchema>

/** A design explored from a saved one. `origin` records exactly what produced it, so it can be reproduced. */
export const variantSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  dna: dnaSchema,
  favourite: z.boolean(),
  origin: z.object({ seed: intRange(0, 4_294_967_295), index: intRange(0, 999), spread: range(0, 1) }).nullable(),
  createdAt: isoDate,
})
export type Variant = z.infer<typeof variantSchema>

/** A restorable earlier state of the design. */
export const snapshotSchema = z.object({
  id,
  label: z.string().max(80),
  at: isoDate,
  dna: dnaSchema,
})
export type Snapshot = z.infer<typeof snapshotSchema>

export const customTypefaceSchema = z.object({
  id,
  familyName: z.string().min(1).max(100),
  styleName: z.string().min(1).max(60),
  /** Version of the generator that the DNA was designed against. See typeface-engine/version.ts. */
  engineVersion: intRange(1, 10_000),
  dna: dnaSchema,
  /** Keyed by character. */
  overrides: z.record(z.string(), glyphOverrideSchema),
  kerning: z.array(kerningPairSchema).max(5000),
  variants: z.array(variantSchema).max(60),
  history: z.array(snapshotSchema).max(30),
  /** Licence the project owner applies to the generated font. Independent of any library licence. */
  license: licenseSchema,
  copyright: z.string().max(500),
})
export type CustomTypeface = z.infer<typeof customTypefaceSchema>

/* ---------- Export history ---------- */

export const exportRecordSchema = z.object({
  id,
  kind: z.enum(['font-ttf', 'font-otf', 'project-json', 'tokens-css', 'tokens-json', 'specimen', 'specimen-pdf', 'spec-md', 'manifest', 'package']),
  at: isoDate,
  filename: z.string().max(255),
  bytes: z.number().int().min(0),
  /** SHA-256 of the exact bytes handed to the user, hex-encoded. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  /** Revision of the saved project content this file was built from (see brand-system/revision.ts). */
  sourceRevision: z.string().regex(/^[0-9a-f]{12}$/).optional(),
})
export type ExportRecord = z.infer<typeof exportRecordSchema>

/* ---------- Project ---------- */

/* ---------- Brand direction ---------- */

export const USE_CASES = ['saas', 'editorial', 'consumer', 'campaign', 'corporate'] as const
export type UseCase = (typeof USE_CASES)[number]
export const TONES = ['confident', 'friendly', 'technical', 'elegant', 'playful', 'serious'] as const
export type Tone = (typeof TONES)[number]

const sampleText = z.string().max(2000)
/** Sample copy used by previews and the specimen. Missing keys fall back to Tynovo's defaults. */
export const sampleCopySchema = z
  .object({ headline: sampleText, subhead: sampleText, body: sampleText, caption: sampleText, action: sampleText, longform: sampleText })
  .partial()
  .strict()
export type SampleCopy = z.infer<typeof sampleCopySchema>

export const brandSchema = z.object({
  /** The brand's own name. Falls back to the project name where one is needed. */
  name: z.string().trim().max(120),
  description: z.string().max(1000),
  personality: z.array(z.string().trim().min(1).max(40)).max(12),
  useCases: z.array(z.enum(USE_CASES)).max(USE_CASES.length),
  tones: z.array(z.enum(TONES)).max(TONES.length),
  /** 1 (low) to 5 (high): how much the type must carry long, small text. */
  readabilityPriority: z.number().int().min(1).max(5),
  /** 1 (low) to 5 (high): how much the type must carry large, expressive text. */
  displayPriority: z.number().int().min(1).max(5),
  notes: z.string().max(5000),
  sampleCopy: sampleCopySchema,
})
export type Brand = z.infer<typeof brandSchema>

/* ---------- Typography settings beyond roles and the scale ---------- */

const stepInt = z.number().int().min(-6).max(12)

/** Heading sizes (H1 to H6) and the two other body sizes, as steps on the type scale. */
export const sizesSchema = z.object({
  headings: z.tuple([stepInt, stepInt, stepInt, stepInt, stepInt, stepInt]),
  bodyLarge: stepInt,
  bodySmall: stepInt,
})
export type Sizes = z.infer<typeof sizesSchema>

/**
 * Fluid type: below `minViewportPx` sizes use the small scale (minBaseSizePx, minRatio); above `maxViewportPx`
 * they use the main scale; in between they interpolate (CSS clamp()). Off by default.
 */
export const responsiveSchema = z
  .object({
    enabled: z.boolean(),
    minViewportPx: z.number().int().min(240).max(900),
    maxViewportPx: z.number().int().min(600).max(3000),
    minBaseSizePx: z.number().min(8).max(64),
    minRatio: z.number().min(1).max(3),
  })
  .refine((r) => r.minViewportPx < r.maxViewportPx, { message: 'The small viewport must be narrower than the large one', path: ['minViewportPx'] })
export type Responsive = z.infer<typeof responsiveSchema>

/** Primary (headings and display) and secondary (body and interface) fonts. Roles can still differ individually. */
export const pairingSchema = z.object({ primary: roleFontSchema.nullable(), secondary: roleFontSchema.nullable() })
export type Pairing = z.infer<typeof pairingSchema>

export const fallbackStackSchema = z.object({
  families: z.array(z.string().trim().min(1).max(200)).max(8),
  generic: z.enum(FALLBACK_STACKS),
})
export type FallbackStack = z.infer<typeof fallbackStackSchema>

export const typographySchema = z.object({
  scale: typeScaleSchema,
  roles: z.array(typographyRoleSchema).max(30),
  sizes: sizesSchema,
  responsive: responsiveSchema,
  pairing: pairingSchema,
  /** Fallback stack of the project's own typeface (existing fonts keep theirs on the font entry). */
  customFallback: fallbackStackSchema,
})
export type Typography = z.infer<typeof typographySchema>

export const projectSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id,
  name: z.string().trim().min(1).max(120),
  createdAt: isoDate,
  updatedAt: isoDate,
  brand: brandSchema,
  typography: typographySchema,
  fontSources: z.array(fontSourceSchema).max(50),
  customTypeface: customTypefaceSchema.nullable(),
  exportHistory: z.array(exportRecordSchema).max(500),
})
export type Project = z.infer<typeof projectSchema>

/** What lists and cards need without loading glyph data. */
export interface ProjectSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  hasCustomTypeface: boolean
  /** The brand's own name when it differs from the project name, else empty. */
  brandName: string
  /** First part of the brand description, for a card. */
  description: string
  tones: Tone[]
  useCases: UseCase[]
  /** Existing fonts in the project, plus one if it has its own typeface. */
  fontCount: number
  rolesTotal: number
  rolesWithFont: number
  typefaceName: string | null
  exportCount: number
  lastExportAt: string | null
}

export function summarize(p: Project): ProjectSummary {
  const brand = p.brand.name.trim()
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    hasCustomTypeface: p.customTypeface !== null,
    brandName: brand && brand !== p.name ? brand : '',
    description: p.brand.description.trim().slice(0, 180),
    tones: p.brand.tones,
    useCases: p.brand.useCases,
    fontCount: p.fontSources.length + (p.customTypeface ? 1 : 0),
    rolesTotal: p.typography.roles.length,
    rolesWithFont: p.typography.roles.filter((r) => r.font !== null).length,
    typefaceName: p.customTypeface ? p.customTypeface.familyName : null,
    exportCount: p.exportHistory.length,
    lastExportAt: p.exportHistory[0]?.at ?? null,
  }
}
