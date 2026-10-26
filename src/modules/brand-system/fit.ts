import type { CustomTypeface, RoleKind, TypographyRole } from '@/modules/brand-projects/schema'
import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { validateTypeface } from '@/modules/font-validation/validate'
import { TARGET_CHARS } from '@/modules/typeface-engine/charset'
import { deriveMetrics } from '@/modules/typeface-engine/dna'

/**
 * Is the project's own typeface appropriate for a role? Two things decide it, both measured from the design:
 *  - coverage: every character the role needs must be a glyph that passes validation (blocks otherwise);
 *  - readability at the role's real size on the type scale (stroke thickness and x-height in pixels, and for
 *    running text a few proportions that make small text hard to read).
 * Findings that do not make the typeface wrong for the role are warnings or notes. Thresholds are rules of
 * thumb, stated next to the code that uses them, not a legibility score.
 */

export type FitLevel = 'blocks' | 'warns' | 'notes'
export type Verdict = 'suitable' | 'caution' | 'unsuitable'

export interface FitFinding {
  id: string
  level: FitLevel
  message: string
  /** A change that resolves it. */
  fix?: { kind: 'weight'; value: number; label: string }
}

export interface RoleFit {
  verdict: Verdict
  findings: FitFinding[]
  /** Characters the role needs that the typeface lacks. */
  missing: string[]
  /** Pixel size the readability checks used. */
  sizePx: number
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const TEXT_PUNCT = '.,:;!?\'"()-/'

/** Characters a role of each kind needs. Display lines are words; running text needs digits and punctuation. */
export const REQUIRED_CHARS: Record<RoleKind, string> = {
  display: `${LETTERS} `,
  heading: `${LETTERS}${DIGITS} .,:;!?'"-`,
  body: `${LETTERS}${DIGITS} ${TEXT_PUNCT}`,
  ui: `${LETTERS}${DIGITS} ${TEXT_PUNCT}%+=#$`,
  caption: `${LETTERS}${DIGITS} ${TEXT_PUNCT}`,
}

export const KIND_LABEL: Record<RoleKind, string> = { display: 'Display', heading: 'Heading', body: 'Body text', ui: 'Interface', caption: 'Caption or label' }

/** Pixels. The thinnest stroke below BLOCK vanishes on ordinary screens; below WARN it turns faint. */
export const STEM_BLOCK_PX = 0.6
export const STEM_WARN_PX = 1
/** Pixels. Below BLOCK the lowercase is not legible; below WARN it is a strain. */
export const XHEIGHT_BLOCK_PX = 4.5
export const XHEIGHT_WARN_PX = 6
/** Display faces are drawn for large sizes. */
export const DISPLAY_MIN_PX = 24

const fmtChars = (chars: string[]) => chars.map((c) => (c === ' ' ? 'space' : c)).join(' ')
const px = (n: number) => `${Math.round(n * 10) / 10}px`

/** Characters of `text` the typeface cannot draw (no glyph, or a glyph that fails validation). Line breaks are ignored. */
export function missingChars(face: Pick<CustomTypeface, 'dna' | 'overrides'>, text: string): string[] {
  const reports = analyzeTypeface(face).reports
  const out: string[] = []
  for (const c of new Set(text)) {
    if (c === '\n' || c === '\r' || c === '\t') continue
    if (reports.get(c)?.status !== 'supported') out.push(c)
  }
  return out
}

export function assessRoleFit(face: CustomTypeface, role: Pick<TypographyRole, 'kind' | 'weight'>, sizePx: number): RoleFit {
  const findings: FitFinding[] = []
  const add = (f: FitFinding) => findings.push(f)
  const { dna } = face
  const m = deriveMetrics(dna)
  const missing = missingChars(face, REQUIRED_CHARS[role.kind]).filter((c) => c !== '\n')
  if (missing.length > 0) {
    add({ id: 'coverage.required', level: 'blocks', message: `${KIND_LABEL[role.kind]} needs characters this typeface does not have: ${fmtChars(missing)}.` })
  }

  const stemPx = (Math.min(dna.strokeThickness, dna.strokeThickness * dna.contrast) / m.unitsPerEm) * sizePx
  if (stemPx < STEM_BLOCK_PX) add({ id: 'stroke.vanishes', level: 'blocks', message: `At ${px(sizePx)} the thinnest stroke is ${px(stemPx)}, which disappears on ordinary screens (minimum ${STEM_BLOCK_PX}px). Use a heavier stroke or a larger size.` })
  else if (stemPx < STEM_WARN_PX) add({ id: 'stroke.faint', level: 'warns', message: `At ${px(sizePx)} the thinnest stroke is ${px(stemPx)}; below ${STEM_WARN_PX}px text looks faint.` })

  const xPx = (m.xHeight / m.unitsPerEm) * sizePx
  if (xPx < XHEIGHT_BLOCK_PX) add({ id: 'xheight.illegible', level: 'blocks', message: `At ${px(sizePx)} lowercase letters are ${px(xPx)} tall, too small to read (minimum ${XHEIGHT_BLOCK_PX}px). Use a larger size.` })
  else if (xPx < XHEIGHT_WARN_PX) add({ id: 'xheight.small', level: 'warns', message: `At ${px(sizePx)} lowercase letters are ${px(xPx)} tall; below ${XHEIGHT_WARN_PX}px reading becomes a strain.` })

  if (role.kind === 'display' && sizePx < DISPLAY_MIN_PX) {
    add({ id: 'display.small', level: 'warns', message: `A display role is set at ${px(sizePx)}. Display designs are drawn for ${DISPLAY_MIN_PX}px and larger.` })
  }

  if (role.kind === 'body' || role.kind === 'ui' || role.kind === 'caption') {
    if (dna.aperture < 0.22) add({ id: 'text.aperture', level: 'warns', message: `Letter openings (C, e, a) are tight (${dna.aperture.toFixed(2)}); at text sizes they can close up.` })
    if (dna.xHeightRatio < 0.58) add({ id: 'text.xratio', level: 'warns', message: `The lowercase is small against the capitals (x-height ${Math.round(dna.xHeightRatio * 100)}% of cap height), which weakens running text.` })
    if (dna.strokeThickness / m.xHeight > 0.3) add({ id: 'text.heavy', level: 'warns', message: 'Strokes are heavy against the x-height, so counters fill in at small sizes.' })
    if (dna.widthScale > 1.35 || dna.widthScale < 0.75) add({ id: 'text.width', level: 'warns', message: `Letters are ${dna.widthScale > 1 ? 'very wide' : 'very narrow'} (width ${dna.widthScale.toFixed(2)}×), which tires the eye over long lines.` })
    if (dna.sidebearing < 30) add({ id: 'text.tight', level: 'warns', message: 'Letters are set very close together; text at small sizes may clot.' })
    if (dna.contrast < 0.6) add({ id: 'text.contrast', level: 'warns', message: 'Horizontal strokes are much thinner than vertical ones, which makes them drop out at small sizes.' })
  }

  if (role.weight >= 600) {
    add({ id: 'weight.synthetic', level: 'warns', message: `The role asks for weight ${role.weight}, but this typeface has one weight (400). Browsers will thicken it artificially, which distorts the design.`, fix: { kind: 'weight', value: 400, label: 'Use weight 400' } })
  } else if (role.weight !== 400) {
    add({ id: 'weight.single', level: 'notes', message: `The role asks for weight ${role.weight}; this typeface has one weight (400) and will draw at that.`, fix: { kind: 'weight', value: 400, label: 'Use weight 400' } })
  }

  if (!validateTypeface(face).exportable) {
    add({ id: 'font.not-exportable', level: 'warns', message: 'The typeface has errors that block font-file export, so no font file can accompany CSS or a specimen until they are fixed.' })
  }

  const verdict: Verdict = findings.some((f) => f.level === 'blocks') ? 'unsuitable' : findings.some((f) => f.level === 'warns') ? 'caution' : 'suitable'
  return { verdict, findings, missing, sizePx }
}

/** What this typeface does not do, stated from the design itself. Shown wherever it is assigned. */
export function typefaceLimits(face: CustomTypeface): string[] {
  const analysis = analyzeTypeface(face)
  const notCovered = TARGET_CHARS.filter((c) => analysis.reports.get(c)?.status !== 'supported')
  const outside = analysis.supported.some((g) => g.char.codePointAt(0)! > 0x7f)
  const out = [
    `One style, ${face.styleName} (weight 400). There is no bold, no light and no italic, so those are synthesised by the browser or drawn as regular.`,
    outside
      ? `Covers ${analysis.supportedCount} characters.`
      : `Covers ${analysis.supportedCount} characters of basic Latin only. Accented letters, curly quotes, dashes and other scripts are drawn in the fallback font.`,
    `No OpenType features other than kerning (${face.kerning.length} pair${face.kerning.length === 1 ? '' : 's'}): no ligatures, alternates, small caps or numeral styles.`,
  ]
  if (notCovered.length > 0) out.push(`Not designed yet: ${fmtChars(notCovered)}.`)
  return out
}
