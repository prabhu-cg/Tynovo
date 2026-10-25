import type { Contour, CustomTypeface, Glyph } from '@/modules/brand-projects/schema'
import { glyphName } from '../typeface-engine/charset'
import { resetOutline, setGlyphOutline } from '../typeface-engine/edit'
import { generateGlyph } from '../typeface-engine/generate'
import { fixWinding, maxX, minX, removeDuplicatePoints, translate } from './outline'
import { sameDraft, type Draft } from './session'

/**
 * Bridges the project’s glyph (generated or hand-edited) and the working copy in the editor.
 * "Applied" is what the project produces for the character now; "generated" is what it would produce with no
 * hand-edited outline.
 */
export function appliedDraft(face: CustomTypeface, char: string): Draft | null {
  const out = generateGlyph(face.dna, char, face.overrides[char])
  return out.ok ? { contours: out.glyph.contours, advanceWidth: out.glyph.advanceWidth } : null
}

/** The shape the generator would give with the frozen outline and its advance width removed (what "reset" returns to). */
export function generatedDraft(face: CustomTypeface, char: string): Draft | null {
  const o = face.overrides[char]
  const { contours: _c, advanceWidth: _a, ...rest } = o ?? {}
  void _c
  void _a
  const out = generateGlyph(face.dna, char, o ? rest : undefined)
  return out.ok ? { contours: out.glyph.contours, advanceWidth: out.glyph.advanceWidth } : null
}

export const asGlyph = (char: string, d: Draft): Glyph => ({ char, name: glyphName(char), advanceWidth: d.advanceWidth, contours: d.contours })

/**
 * Put the working copy into the project. A working copy identical to the generated shape is stored as "no hand
 * edit" (the glyph follows the global design again); anything else becomes a frozen outline.
 */
export function applyDraft(face: CustomTypeface, char: string, d: Draft): CustomTypeface {
  const generated = generatedDraft(face, char)
  if (generated && sameDraft(d, generated)) return resetOutline(face, char)
  return setGlyphOutline(face, char, d.contours, d.advanceWidth)
}

/* ---------- spacing edits on the working copy ---------- */

export const leftBearingOf = (d: Draft) => (d.contours.length ? minX(d.contours) : 0)
export const rightBearingOf = (d: Draft) => (d.contours.length ? d.advanceWidth - maxX(d.contours) : d.advanceWidth)

/** Set the left side bearing: the outline moves and the advance follows, so the right bearing is unchanged. */
export function withLeftBearing(d: Draft, value: number): Draft {
  if (!d.contours.length) return d
  const dx = Math.round(value) - leftBearingOf(d)
  if (dx === 0) return d
  const moved: Contour[] = translate(d.contours, dx, 0)
  return { contours: moved, advanceWidth: Math.max(0, d.advanceWidth + dx) }
}

/** Set the right side bearing by changing the advance width. */
export function withRightBearing(d: Draft, value: number): Draft {
  if (!d.contours.length) return d
  const advanceWidth = Math.max(0, Math.round(maxX(d.contours) + value))
  return advanceWidth === d.advanceWidth ? d : { ...d, advanceWidth }
}

export const withAdvance = (d: Draft, value: number): Draft => (Math.round(value) === d.advanceWidth ? d : { ...d, advanceWidth: Math.max(0, Math.round(value)) })

/** Neighbours that show how a glyph sits in running text: straight stems for letters, zeros for digits. */
export function contextText(char: string): string {
  if (/[A-Z]/.test(char)) return `HH${char}HH OO${char}OO`
  if (/[a-z]/.test(char)) return `nn${char}nn oo${char}oo`
  if (/[0-9]/.test(char)) return `00${char}00 11${char}11`
  return `H${char}H n${char}n 0${char}0`
}

/* ---------- one-click repairs for the problems the checks name ---------- */

export interface DraftFix {
  label: string
  apply: (d: Draft) => Draft
}

/** Repairs that are safe to offer for the issues found in a working copy. Anything else is left to the person. */
export function draftFixes(codes: ReadonlySet<string>, d: Draft, sidebearing: number): DraftFix[] {
  const fixes: DraftFix[] = []
  if (codes.has('glyph.winding')) {
    fixes.push({ label: 'Fix contour direction', apply: (x) => ({ ...x, contours: fixWinding(x.contours).contours }) })
  }
  if (codes.has('glyph.self-intersection') && removeDuplicatePoints(d.contours).removed > 0) {
    fixes.push({ label: 'Remove stacked points', apply: (x) => ({ ...x, contours: removeDuplicatePoints(x.contours).contours }) })
  }
  if (codes.has('glyph.overhang')) {
    fixes.push({ label: 'Fit the advance width to the outline', apply: (x) => withRightBearing(x, sidebearing) })
  }
  if (codes.has('glyph.negative-bearing')) {
    fixes.push({ label: 'Shift the outline right of the origin', apply: (x) => withLeftBearing(x, sidebearing) })
  }
  return fixes
}
