import type { Contour, CustomTypeface, FontMetrics, Glyph } from '../brand-projects/schema'
import { contoursBounds, type Bounds } from '../glyph-editor/geometry'
import { fixWinding, removeDuplicatePoints, translate } from '../glyph-editor/outline'
import { dnaIssues, deriveMetrics } from '../typeface-engine/dna'
import { resetGlyph, setGlyphOutline, setGlyphSpacing, setKerning } from '../typeface-engine/edit'
import { bearing, generateGlyph } from '../typeface-engine/generate'
import { SPECS } from '../typeface-engine/glyphs'
import { LICENSE_PLACEHOLDER } from '../typeface-engine/typeface'
import { ENGINE_VERSION } from '../typeface-engine/version'
import { analyzeTypeface, type GlyphReport, type TypefaceAnalysis } from './coverage'
import { median, pairGap } from './spacing'
import type { ValidationIssue } from './validate'

/**
 * Evidence-based quality checks. Every finding says what was measured, shows the numbers, explains why it can
 * matter, and where a safe fix exists offers it. There is deliberately no overall score: a single number would
 * suggest an objective measure of typographic quality, and these checks measure only geometry and metadata.
 *
 * Severity:
 *  - blocking:       the font cannot be exported (or would not be the font the design describes) until fixed.
 *  - warning:        likely to cause a visible or technical problem; the font can still be exported.
 *  - recommendation: worth knowing or improving; may be a deliberate design choice.
 */
export type QualitySeverity = 'blocking' | 'warning' | 'recommendation'
export type QualityCategory = 'coverage' | 'outlines' | 'mapping' | 'metrics' | 'widths' | 'spacing' | 'metadata' | 'file'

export const CATEGORY_LABEL: Record<QualityCategory, string> = {
  coverage: 'Coverage',
  outlines: 'Outlines',
  mapping: 'Character mapping',
  metrics: 'Metrics and alignment',
  widths: 'Advance widths',
  spacing: 'Spacing',
  metadata: 'Font information',
  file: 'Exported file',
}

export type QualityFix =
  | { kind: 'edit'; label: string; apply: (face: CustomTypeface) => CustomTypeface }
  | { kind: 'go'; label: string; view: 'glyphs' | 'info' | 'preview'; glyph?: string; text?: string }

export interface QualityFinding {
  id: string
  severity: QualitySeverity
  category: QualityCategory
  title: string
  /** What was measured, in a sentence. */
  detail: string
  /** The numbers behind it, one line each. */
  evidence: string[]
  /** Why it can matter. */
  why: string
  /** Characters involved; the interface links each to the editor. */
  glyphs: string[]
  fixes: QualityFix[]
}

export interface CheckInfo {
  id: string
  category: QualityCategory
  name: string
  measures: string
  limits: string
}

export interface QualityReport {
  findings: QualityFinding[]
  counts: Record<QualitySeverity, number>
  checks: CheckInfo[]
  /** True when results of building and re-reading the file were supplied. */
  fileChecked: boolean
}

/* ---------- context ---------- */

interface GlyphInfo {
  char: string
  glyph: Glyph
  status: GlyphReport['status']
  bounds: Bounds | null
  lsb: number
  rsb: number
}

interface Ctx {
  face: CustomTypeface
  analysis: TypefaceAnalysis
  metrics: FontMetrics
  info: Map<string, GlyphInfo>
}

const show = (c: string) => (c === ' ' ? 'space' : c)
const list = (chars: string[]) => chars.map(show).join(' ')
const fmt = (n: number) => String(Math.round(n * 10) / 10)

function buildContext(face: CustomTypeface): Ctx {
  const analysis = analyzeTypeface(face)
  const info = new Map<string, GlyphInfo>()
  for (const r of analysis.reports.values()) {
    if (!r.glyph) continue
    const bounds = contoursBounds(r.glyph.contours)
    info.set(r.char, { char: r.char, glyph: r.glyph, status: r.status, bounds, lsb: bounds ? bounds.minX : 0, rsb: bounds ? r.glyph.advanceWidth - bounds.maxX : r.glyph.advanceWidth })
  }
  return { face, analysis, metrics: deriveMetrics(face.dna), info }
}

/** Re-edit the outline a glyph has right now (generated or frozen) and freeze the result. */
function editOutline(face: CustomTypeface, char: string, fn: (contours: Contour[], advance: number) => { contours: Contour[]; advance?: number }): CustomTypeface {
  const out = generateGlyph(face.dna, char, face.overrides[char])
  if (!out.ok) return face
  const next = fn(out.glyph.contours, out.glyph.advanceWidth)
  return setGlyphOutline(face, char, next.contours, next.advance ?? out.glyph.advanceWidth)
}

const goEdit = (char: string): QualityFix => ({ kind: 'go', label: `Open ${show(char)} in the editor`, view: 'glyphs', glyph: char })
const goInfo = (label: string): QualityFix => ({ kind: 'go', label, view: 'info' })

function finding(f: Omit<QualityFinding, 'evidence' | 'fixes' | 'glyphs'> & Partial<Pick<QualityFinding, 'evidence' | 'fixes' | 'glyphs'>>): QualityFinding {
  return { evidence: [], fixes: [], glyphs: [], ...f }
}

/* ---------- 1. coverage ---------- */

function coverage(ctx: Ctx): QualityFinding[] {
  const out: QualityFinding[] = []
  const reports = [...ctx.analysis.reports.values()]
  if (ctx.analysis.supportedCount === 0) {
    out.push(finding({ id: 'coverage.none', severity: 'blocking', category: 'coverage', title: 'No glyph can be exported', detail: 'Not a single glyph passes validation.', why: 'A font with no glyphs is not a font.', fixes: [{ kind: 'go', label: 'See the glyph errors', view: 'glyphs' }] }))
  }
  const missing = reports.filter((r) => r.status === 'missing')
  const noRecipe = missing.filter((r) => r.reason === 'no-recipe').map((r) => r.char)
  const failed = missing.filter((r) => r.reason !== 'no-recipe')
  if (noRecipe.length) {
    const important = noRecipe.filter((c) => /[A-Za-z0-9]/.test(c))
    out.push(
      finding({
        id: 'coverage.not-designed',
        severity: important.length ? 'warning' : 'recommendation',
        category: 'coverage',
        title: `${noRecipe.length} target character${noRecipe.length > 1 ? 's are' : ' is'} not designed yet`,
        detail: `The generator has no design for ${list(noRecipe)}, so ${noRecipe.length > 1 ? 'they are' : 'it is'} not in the font.`,
        evidence: [`${ctx.analysis.supportedCount} of ${ctx.analysis.total} target characters are in the font.`],
        why: 'Text that uses these characters falls back to another font in the program that opens yours.',
        glyphs: noRecipe,
      }),
    )
  }
  if (failed.length) {
    out.push(
      finding({
        id: 'coverage.failed',
        severity: 'warning',
        category: 'coverage',
        title: `${failed.length} character${failed.length > 1 ? 's' : ''} could not be built`,
        detail: `The generator failed for ${list(failed.map((r) => r.char))} with the current settings.`,
        evidence: failed.map((r) => `${show(r.char)}: ${r.message ?? r.reason}`),
        why: 'Those characters are left out of the font.',
        glyphs: failed.map((r) => r.char),
        fixes: failed.filter((r) => r.char in ctx.face.overrides).slice(0, 1).map((r) => ({ kind: 'edit' as const, label: `Reset ${show(r.char)} to the generated design`, apply: (f: CustomTypeface) => resetGlyph(f, r.char) })),
      }),
    )
  }
  return out
}

/* ---------- 2. outlines ---------- */

const GEOMETRY_ERRORS: Record<string, { title: string; why: string }> = {
  'glyph.empty': { title: 'Visible characters without an outline', why: 'The character would show as blank space.' },
  'glyph.degenerate': { title: 'Contours with fewer than three points', why: 'A contour with fewer than three points encloses nothing; some programs reject the whole font.' },
  'glyph.non-finite': { title: 'Outlines with invalid coordinates', why: 'Coordinates that are not real numbers cannot be written into a font.' },
  'glyph.fractional': { title: 'Outlines with fractional coordinates', why: 'TrueType stores whole units; fractions would be rounded and change the shape.' },
  'glyph.zero-area': { title: 'Contours with no area', why: 'A flat contour draws nothing but can confuse rasterisers and validators.' },
  'glyph.self-intersection': { title: 'Outlines that cross or touch themselves', why: 'Crossing outlines fill unpredictably: the same glyph can render differently in different programs.' },
  'glyph.winding': { title: 'Contours running the wrong way', why: 'Outer contours must run clockwise and counters counter-clockwise, or counters can fill in.' },
  'glyph.counter-outside': { title: 'Counters outside solid area', why: 'A hole that is not inside a shape renders as a separate shape in some programs.' },
  'glyph.outside-metrics': { title: 'Outlines beyond the vertical metrics', why: 'Ink outside ascender and descender can be clipped by programs that respect those lines.' },
  'glyph.zero-advance': { title: 'Visible glyphs with zero advance width', why: 'The next character would be drawn on top of this one.' },
}

function geometry(ctx: Ctx): QualityFinding[] {
  const out: QualityFinding[] = []
  const byCode = new Map<string, Array<{ char: string; message: string }>>()
  for (const r of ctx.analysis.reports.values()) {
    for (const i of r.issues.filter((x) => x.severity === 'error')) byCode.set(i.code, [...(byCode.get(i.code) ?? []), { char: r.char, message: i.message }])
  }
  for (const [code, items] of byCode) {
    const meta = GEOMETRY_ERRORS[code] ?? { title: 'Outline errors', why: 'The glyph fails validation and is left out of the font.' }
    const chars = [...new Set(items.map((i) => i.char))]
    const fixes: QualityFix[] = []
    if (code === 'glyph.winding') {
      fixes.push({ kind: 'edit', label: `Reverse the wrong contours in ${list(chars)}`, apply: (f) => chars.reduce((acc, c) => editOutline(acc, c, (cs) => ({ contours: fixWinding(cs).contours })), f) })
    }
    if (code === 'glyph.zero-advance') {
      const withAdvance = chars.filter((c) => ctx.face.overrides[c]?.advanceWidth !== undefined)
      if (withAdvance.length) fixes.push({ kind: 'edit', label: `Follow automatic spacing for ${list(withAdvance)}`, apply: (f) => withAdvance.reduce((acc, c) => setGlyphSpacing(acc, c, { advanceWidth: undefined }), f) })
    }
    if (code === 'glyph.self-intersection') {
      const stacked = chars.filter((c) => removeDuplicatePoints(ctx.info.get(c)?.glyph.contours ?? []).removed > 0)
      if (stacked.length) fixes.push({ kind: 'edit', label: `Remove stacked points from ${list(stacked)}`, apply: (f) => stacked.reduce((acc, c) => editOutline(acc, c, (cs) => ({ contours: removeDuplicatePoints(cs).contours })), f) })
    }
    if (chars.length === 1) fixes.push(goEdit(chars[0]!))
    const resettable = chars.filter((c) => c in ctx.face.overrides)
    if (resettable.length) fixes.push({ kind: 'edit', label: `Reset ${list(resettable)} to the generated design`, apply: (f) => resettable.reduce((acc, c) => resetGlyph(acc, c), f) })
    out.push(finding({ id: code, severity: 'blocking', category: 'outlines', title: meta.title, detail: `${chars.length} glyph${chars.length > 1 ? 's fail' : ' fails'} this check and ${chars.length > 1 ? 'are' : 'is'} left out of the font: ${list(chars)}.`, evidence: items.map((i) => `${show(i.char)}: ${i.message}`), why: meta.why, glyphs: chars, fixes }))
  }

  const info = [...ctx.info.values()].filter((g) => g.status === 'supported')
  const negative = info.filter((g) => g.bounds && g.bounds.minX < 0)
  if (negative.length) {
    out.push(
      finding({
        id: 'glyph.negative-bearing',
        severity: 'warning',
        category: 'outlines',
        title: 'Outlines that start left of the origin',
        detail: `${list(negative.map((g) => g.char))} ${negative.length > 1 ? 'have' : 'has'} a negative left side bearing.`,
        evidence: negative.map((g) => `${show(g.char)}: ink starts at x = ${g.bounds!.minX}`),
        why: 'Ink left of the origin can collide with the previous character or be clipped by programs that crop to the advance box.',
        glyphs: negative.map((g) => g.char),
        fixes: [{ kind: 'edit', label: `Shift ${list(negative.map((g) => g.char))} right to the automatic left bearing`, apply: (f) => negative.reduce((acc, g) => editOutline(acc, g.char, (cs, adv) => { const dx = bearing(f.dna, 'straight', 'left') - g.bounds!.minX; return { contours: translate(cs, dx, 0), advance: adv + dx } }), f) }],
      }),
    )
  }
  const overhang = info.filter((g) => g.bounds && g.glyph.advanceWidth < g.bounds.maxX)
  if (overhang.length) {
    out.push(
      finding({
        id: 'glyph.overhang',
        severity: 'warning',
        category: 'outlines',
        title: 'Outlines that extend past the advance width',
        detail: `${list(overhang.map((g) => g.char))} ${overhang.length > 1 ? 'draw' : 'draws'} ink beyond ${overhang.length > 1 ? 'their' : 'its'} advance width.`,
        evidence: overhang.map((g) => `${show(g.char)}: ink ends at ${g.bounds!.maxX}, advance is ${g.glyph.advanceWidth} (${g.bounds!.maxX - g.glyph.advanceWidth} over)`),
        why: 'The overhang runs into the next character and can be clipped.',
        glyphs: overhang.map((g) => g.char),
        fixes: [{ kind: 'edit', label: `Fit the advance width of ${list(overhang.map((g) => g.char))} to the outline`, apply: (f) => overhang.reduce((acc, g) => setGlyphSpacing(acc, g.char, { advanceWidth: Math.round(g.bounds!.maxX + bearing(f.dna, 'straight', 'right')) }), f) }],
      }),
    )
  }

  const dupes: Array<{ char: string; removed: number }> = []
  for (const g of ctx.info.values()) {
    const d = removeDuplicatePoints(g.glyph.contours)
    if (d.removed > 0) dupes.push({ char: g.char, removed: d.removed })
  }
  const specks: Array<{ char: string; index: number; area: number }> = []
  const heavy: Array<{ char: string; points: number }> = []
  for (const g of ctx.info.values()) {
    g.glyph.contours.forEach((c, index) => {
      const b = contoursBounds([c])!
      const area = Math.abs(shoelace(c))
      if (c.length >= 3 && (area < 400 || Math.max(b.maxX - b.minX, b.maxY - b.minY) < 12)) specks.push({ char: g.char, index, area })
    })
    const points = g.glyph.contours.reduce((n, c) => n + c.length, 0)
    if (points > 800) heavy.push({ char: g.char, points })
  }
  if (specks.length) {
    const chars = [...new Set(specks.map((s) => s.char))]
    out.push(
      finding({
        id: 'outlines.specks',
        severity: 'warning',
        category: 'outlines',
        title: 'Tiny stray contours',
        detail: `${list(chars)} ${chars.length > 1 ? 'contain' : 'contains'} contours smaller than 12 units or under 400 square units in area.`,
        evidence: specks.map((s) => `${show(s.char)}: contour ${s.index + 1}, area ${fmt(s.area)}`),
        why: 'A speck this small is usually a leftover from editing. It is invisible at normal sizes but adds clutter and can show as a dot when a font is enlarged.',
        glyphs: chars,
        fixes: [{ kind: 'edit', label: `Remove the tiny contours from ${list(chars)}`, apply: (f) => chars.reduce((acc, c) => editOutline(acc, c, (cs) => ({ contours: cs.filter((k) => { const b = contoursBounds([k])!; return !(Math.abs(shoelace(k)) < 400 || Math.max(b.maxX - b.minX, b.maxY - b.minY) < 12) }) })), f) }],
      }),
    )
  }
  if (dupes.length) {
    const chars = dupes.map((d) => d.char)
    out.push(
      finding({
        id: 'outlines.duplicate-points',
        severity: 'warning',
        category: 'outlines',
        title: 'Points stacked on top of each other',
        detail: `${list(chars)} ${chars.length > 1 ? 'have' : 'has'} consecutive points at the same position.`,
        evidence: dupes.map((d) => `${show(d.char)}: ${d.removed} duplicate point${d.removed > 1 ? 's' : ''}`),
        why: 'Zero-length segments add nothing and can upset curve smoothing and validators.',
        glyphs: chars,
        fixes: [{ kind: 'edit', label: `Remove duplicate points from ${list(chars)}`, apply: (f) => chars.reduce((acc, c) => editOutline(acc, c, (cs) => ({ contours: removeDuplicatePoints(cs).contours })), f) }],
      }),
    )
  }
  if (heavy.length) {
    out.push(finding({ id: 'outlines.heavy', severity: 'recommendation', category: 'outlines', title: 'Very detailed outlines', detail: `${list(heavy.map((h) => h.char))} ${heavy.length > 1 ? 'have' : 'has'} more than 800 points.`, evidence: heavy.map((h) => `${show(h.char)}: ${h.points} points`), why: 'Outlines this detailed make the file larger and slower to render.', glyphs: heavy.map((h) => h.char) }))
  }
  return out
}

function shoelace(c: Contour): number {
  let s = 0
  for (let i = 0; i < c.length; i++) {
    const a = c[i]!
    const b = c[(i + 1) % c.length]!
    s += a.x * b.y - b.x * a.y
  }
  return s / 2
}

/* ---------- 3. mapping ---------- */

export interface MappingEntry {
  char: string
  name: string
}

const GLYPH_NAME = /^[A-Za-z_.][A-Za-z0-9_.]{0,62}$/

/** Pure so it can be tested with entries the generator would never produce. */
export function mappingFindings(entries: MappingEntry[]): QualityFinding[] {
  const out: QualityFinding[] = []
  const codes = new Map<number, string[]>()
  const names = new Map<string, string[]>()
  for (const e of entries) {
    const cp = e.char.codePointAt(0)!
    codes.set(cp, [...(codes.get(cp) ?? []), e.char])
    names.set(e.name, [...(names.get(e.name) ?? []), e.char])
  }
  const dupCodes = [...codes].filter(([, v]) => v.length > 1)
  if (dupCodes.length) {
    out.push(finding({ id: 'mapping.duplicate-codepoint', severity: 'blocking', category: 'mapping', title: 'One code point mapped to several glyphs', detail: 'A character can map to only one glyph.', evidence: dupCodes.map(([cp, v]) => `U+${hex(cp)} is used by ${v.length} glyphs`), why: 'The program that opens the font would pick one of them arbitrarily.' }))
  }
  const dupNames = [...names].filter(([, v]) => v.length > 1)
  if (dupNames.length) {
    out.push(finding({ id: 'mapping.duplicate-name', severity: 'blocking', category: 'mapping', title: 'Two glyphs with the same name', detail: 'Glyph names must be unique within a font.', evidence: dupNames.map(([n, v]) => `“${n}” is used by ${list(v)}`), why: 'Duplicate names make kerning and tools that refer to glyphs by name ambiguous.', glyphs: dupNames.flatMap(([, v]) => v) }))
  }
  const badNames = entries.filter((e) => !GLYPH_NAME.test(e.name))
  if (badNames.length) {
    out.push(finding({ id: 'mapping.invalid-name', severity: 'blocking', category: 'mapping', title: 'Invalid glyph names', detail: 'Glyph names use letters, digits, underscore and full stop, do not start with a digit, and are at most 63 characters.', evidence: badNames.map((e) => `${show(e.char)}: “${e.name}”`), why: 'Fonts with invalid glyph names are rejected by some tools.', glyphs: badNames.map((e) => e.char) }))
  }
  const badCodes = entries.filter((e) => { const cp = e.char.codePointAt(0)!; return cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) })
  if (badCodes.length) {
    out.push(finding({ id: 'mapping.invalid-codepoint', severity: 'blocking', category: 'mapping', title: 'Characters that are not valid Unicode scalar values', detail: 'Surrogate halves and values above U+10FFFF cannot be mapped.', evidence: badCodes.map((e) => `U+${hex(e.char.codePointAt(0)!)}`), why: 'The cmap table would be invalid.', glyphs: badCodes.map((e) => e.char) }))
  }
  return out
}
const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0')

function mapping(ctx: Ctx): QualityFinding[] {
  return mappingFindings(ctx.analysis.supported.map((g) => ({ char: g.char, name: g.name })))
}

/* ---------- 4. metrics and alignment ---------- */

const DESCENDERS = new Set('gjpqyQ')
const X_HEIGHT = [...'acegmnopqrsuvwxyz']
const ASCENDER = [...'bdfhkl']
const CAPS_AND_DIGITS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789']
const FLAT_X = [...'xzvw']
const FLAT_CAP = [...'HEILTZ']

function alignment(ctx: Ctx): QualityFinding[] {
  const out: QualityFinding[] = []
  const { metrics: m, face } = ctx
  const tol = face.dna.overshoot + 2
  const supported = (c: string) => ctx.info.get(c)?.status === 'supported'

  const baseline = [...ctx.info.values()].filter((g) => g.bounds && /[A-Za-z0-9]/.test(g.char) && !DESCENDERS.has(g.char) && supported(g.char) && (g.bounds.minY < -tol || g.bounds.minY > 2))
  if (baseline.length) {
    out.push(
      finding({
        id: 'metrics.baseline',
        severity: 'warning',
        category: 'metrics',
        title: 'Glyph bottoms off the baseline',
        detail: `${list(baseline.map((g) => g.char))} ${baseline.length > 1 ? 'do' : 'does'} not sit on the baseline (allowed: 0 down to −${face.dna.overshoot}, the round overshoot).`,
        evidence: baseline.map((g) => `${show(g.char)}: lowest point at y = ${g.bounds!.minY}`),
        why: 'In a line of text the letter looks like it is floating or sinking.',
        glyphs: baseline.map((g) => g.char),
        fixes: [goEdit(baseline[0]!.char)],
      }),
    )
  }
  const zones: Array<{ id: string; label: string; chars: string[]; target: number; name: string }> = [
    { id: 'cap', label: 'Capitals and digits', chars: CAPS_AND_DIGITS, target: m.capHeight, name: 'cap height' },
    { id: 'x', label: 'Lowercase', chars: X_HEIGHT, target: m.xHeight, name: 'x-height' },
    { id: 'asc', label: 'Tall lowercase', chars: ASCENDER, target: m.capHeight + face.dna.ascenderRise, name: 'ascender height' },
  ]
  for (const z of zones) {
    const off = z.chars.map((c) => ctx.info.get(c)).filter((g): g is GlyphInfo => !!g && g.status === 'supported' && !!g.bounds && (g.bounds.maxY < z.target - 2 || g.bounds.maxY > z.target + tol))
    if (off.length) {
      out.push(
        finding({
          id: `metrics.top-${z.id}`,
          severity: 'warning',
          category: 'metrics',
          title: `${z.label} off the ${z.name}`,
          detail: `${list(off.map((g) => g.char))} ${off.length > 1 ? 'do' : 'does'} not reach the ${z.name} of ${z.target} (allowed up to ${z.target + face.dna.overshoot} for round shapes).`,
          evidence: off.map((g) => `${show(g.char)}: top at y = ${g.bounds!.maxY} (${g.bounds!.maxY - z.target > 0 ? '+' : ''}${g.bounds!.maxY - z.target})`),
          why: 'Uneven tops make a word look ragged, and the declared metric no longer describes the letters.',
          glyphs: off.map((g) => g.char),
          fixes: [goEdit(off[0]!.char)],
        }),
      )
    }
  }
  const measuredX = median(FLAT_X.map((c) => ctx.info.get(c)?.bounds?.maxY).filter((v): v is number => v !== undefined))
  if (measuredX && Math.abs(measuredX - m.xHeight) > 2) {
    out.push(finding({ id: 'metrics.x-height', severity: 'warning', category: 'metrics', title: 'The declared x-height does not match the letters', detail: `The flat-topped lowercase letters (${FLAT_X.join(' ')}) reach ${measuredX}, but the font declares an x-height of ${m.xHeight}.`, evidence: [`Declared x-height ${m.xHeight}; measured ${measuredX}.`], why: 'Programs use the declared x-height for optical sizing and for matching fonts.', glyphs: FLAT_X }))
  }
  const measuredCap = median(FLAT_CAP.map((c) => ctx.info.get(c)?.bounds?.maxY).filter((v): v is number => v !== undefined))
  if (measuredCap && Math.abs(measuredCap - m.capHeight) > 2) {
    out.push(finding({ id: 'metrics.cap-height', severity: 'warning', category: 'metrics', title: 'The declared cap height does not match the letters', detail: `The flat-topped capitals (${FLAT_CAP.join(' ')}) reach ${measuredCap}, but the font declares a cap height of ${m.capHeight}.`, evidence: [`Declared cap height ${m.capHeight}; measured ${measuredCap}.`], why: 'Programs use the declared cap height to align text to other elements.', glyphs: FLAT_CAP }))
  }
  return out
}

function parameters(ctx: Ctx): QualityFinding[] {
  const out: QualityFinding[] = []
  for (const i of dnaIssues(ctx.face.dna)) {
    out.push(finding({ id: i.code, severity: i.severity === 'error' ? 'blocking' : i.severity === 'warning' ? 'warning' : 'recommendation', category: 'metrics', title: 'Design parameter', detail: i.message, why: 'The design parameters contradict each other, so the generator adjusts or ignores one of them.' }))
  }
  if (ctx.face.engineVersion > ENGINE_VERSION) {
    out.push(finding({ id: 'engine.newer', severity: 'warning', category: 'metrics', title: 'Designed with a newer generator', detail: `This design was made with generator version ${ctx.face.engineVersion}; this app has version ${ENGINE_VERSION}.`, why: 'Glyphs may look different from what the design was made against.' }))
  } else if (ctx.face.engineVersion < ENGINE_VERSION) {
    out.push(finding({ id: 'engine.older', severity: 'recommendation', category: 'metrics', title: 'Designed with an older generator', detail: `This design was made with generator version ${ctx.face.engineVersion}; glyphs are regenerated with version ${ENGINE_VERSION}.`, why: 'Glyphs may differ slightly from the version you last looked at. Check the shapes you care about.' }))
  }
  return out
}

/* ---------- 5. advance widths ---------- */

const NARROW = new Set([...'Iijl1'])
const WIDE = new Set([...'mwMW'])
const WIDTH_GROUPS: Array<{ label: string; chars: string }> = [
  { label: 'uppercase', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { label: 'lowercase', chars: 'abcdefghijklmnopqrstuvwxyz' },
  { label: 'digit', chars: '0123456789' },
]

function widths(ctx: Ctx): QualityFinding[] {
  const out: QualityFinding[] = []
  const odd: Array<{ char: string; text: string }> = []
  for (const g of WIDTH_GROUPS) {
    const present = [...g.chars].map((c) => ctx.info.get(c)).filter((x): x is GlyphInfo => !!x && x.status === 'supported')
    const typical = present.filter((x) => !NARROW.has(x.char) && !WIDE.has(x.char))
    if (typical.length < 3) continue
    const med = median(typical.map((x) => x.glyph.advanceWidth))
    for (const x of present) {
      if (NARROW.has(x.char)) continue
      const ratio = x.glyph.advanceWidth / med
      const limit = WIDE.has(x.char) ? 2.2 : 1.8
      if (ratio > limit || ratio < 0.4) odd.push({ char: x.char, text: `${show(x.char)}: advance ${x.glyph.advanceWidth} is ${fmt(ratio)}× the ${g.label} median of ${fmt(med)}` })
    }
  }
  if (odd.length) {
    out.push(
      finding({
        id: 'widths.outliers',
        severity: 'warning',
        category: 'widths',
        title: 'Unusual advance widths',
        detail: `${list(odd.map((o) => o.char))} ${odd.length > 1 ? 'are' : 'is'} much wider or narrower than ${odd.length > 1 ? 'their' : 'its'} neighbours in the same group.`,
        evidence: odd.map((o) => o.text),
        why: 'It may be intended (a wide W, a narrow I), but a stray width override or a shape that grew is the more common cause, and it shows as a hole or a crowd in running text.',
        glyphs: odd.map((o) => o.char),
        fixes: [
          ...(odd.some((o) => ctx.face.overrides[o.char]?.advanceWidth !== undefined) ? [{ kind: 'edit' as const, label: `Follow automatic spacing for ${list(odd.filter((o) => ctx.face.overrides[o.char]?.advanceWidth !== undefined).map((o) => o.char))}`, apply: (f: CustomTypeface) => odd.reduce((acc, o) => setGlyphSpacing(acc, o.char, { advanceWidth: undefined }), f) }] : []),
          goEdit(odd[0]!.char),
        ],
      }),
    )
  }
  const space = ctx.info.get(' ')
  const lowerMedian = median([...'nopqu'].map((c) => ctx.info.get(c)?.glyph.advanceWidth).filter((v): v is number => v !== undefined))
  if (space && lowerMedian) {
    const ratio = space.glyph.advanceWidth / lowerMedian
    if (ratio < 0.25 || ratio > 1) {
      out.push(finding({ id: 'widths.space', severity: 'recommendation', category: 'widths', title: ratio < 0.25 ? 'The space is very narrow' : 'The space is very wide', detail: `The space is ${space.glyph.advanceWidth} units, ${fmt(ratio)}× a typical lowercase letter (${fmt(lowerMedian)}).`, evidence: [`Space ${space.glyph.advanceWidth}; typical lowercase width ${fmt(lowerMedian)}.`], why: ratio < 0.25 ? 'Words will run together.' : 'Words will fall apart into separate shapes.', glyphs: [' '] }))
    }
  }
  return out
}

/* ---------- 6. spacing ---------- */

const UPPER_PAIRS = ['HO', 'OH', 'OO', 'DO', 'CO', 'RO', 'HT', 'TH', 'EO']
const LOWER_PAIRS = ['no', 'on', 'oo', 'ac', 'uo', 'ee', 'rn', 'ox', 'ya', 'wa']
/** Combinations designers conventionally kern, because diagonal and open shapes leave a hole. */
const KERN_CLASSICS = ['AV', 'VA', 'AT', 'TA', 'AY', 'YA', 'LT', 'LV', 'LY', 'WA', 'AW', 'TO', 'OT', 'TV', 'VT', 'FA', 'PA', 'AP']
const REF_UPPER = ['HH', 'HI', 'IH', 'II']
const REF_LOWER = ['nn', 'nm', 'hn', 'ln']
const BIG = 4000
/** Target for a pair that was too loose: this multiple of the straight-stem reference gap. */
const KERN_TARGET = 1.5
const KERN_LOOSE_RATIO = 2.4
const NEAR_TOUCH = 20
/** Kerning never brings two outlines closer than this (or a third of the straight-stem gap, if larger). */
const MIN_AFTER = 40

function kernFor(face: CustomTypeface, l: string, r: string): number {
  return face.kerning.find((k) => k.left === l && k.right === r)?.value ?? 0
}

function spacing(ctx: Ctx): QualityFinding[] {
  const out: QualityFinding[] = []
  const { face, metrics: m } = ctx
  const g = (c: string) => {
    const i = ctx.info.get(c)
    return i?.status === 'supported' ? i.glyph : undefined
  }

  // Side bearings that differ from what automatic spacing would give. Glyphs that follow it match by construction.
  const tracking = face.dna.tracking
  const off: Array<{ char: string; tight: boolean; text: string }> = []
  for (const c of Object.keys(face.overrides)) {
    const i = ctx.info.get(c)
    const spec = SPECS[c]
    if (!i || !spec || i.status !== 'supported' || !i.bounds) continue
    const wantL = bearing(face.dna, spec.left, 'left')
    const wantR = Math.max(0, bearing(face.dna, spec.right, 'right') + tracking)
    for (const [side, have, want] of [['left', i.lsb, wantL], ['right', i.rsb, wantR]] as const) {
      const tight = want - have > 20 && have < want * 0.4
      const loose = have - want > 60 && have > want * 2.2
      if (tight || loose) off.push({ char: c, tight, text: `${show(c)} ${side} bearing ${have}, automatic spacing would give ${want}` })
    }
  }
  if (off.length) {
    const chars = [...new Set(off.map((o) => o.char))]
    const tight = off.some((o) => o.tight)
    out.push(
      finding({
        id: 'spacing.bearings',
        severity: tight ? 'warning' : 'recommendation',
        category: 'spacing',
        title: 'Side bearings far from automatic spacing',
        detail: `${list(chars)} ${chars.length > 1 ? 'have' : 'has'} an override that leaves much less or much more space than the design’s own spacing rules.`,
        evidence: off.map((o) => o.text),
        why: 'Tight sides make letters collide in words; loose sides leave holes. Either can be deliberate for a display face.',
        glyphs: chars,
        fixes: [
          ...(chars.some((c) => face.overrides[c] && !face.overrides[c]!.contours) ? [{ kind: 'edit' as const, label: `Follow automatic spacing for ${list(chars.filter((c) => !face.overrides[c]?.contours))}`, apply: (f: CustomTypeface) => chars.filter((c) => !f.overrides[c]?.contours).reduce((acc, c) => setGlyphSpacing(acc, c, { leftBearing: undefined, rightBearing: undefined, advanceWidth: undefined }), f) }] : []),
          goEdit(chars[0]!),
        ],
      }),
    )
  }

  // Pair spacing: measured gaps between neighbouring outlines, relative to straight stems.
  const refOf = (pairs: string[], top: number) => median(pairs.map((p) => (g(p[0]!) && g(p[1]!) ? pairGap(g(p[0]!)!, g(p[1]!)!, 0, 0, top, BIG).mean : NaN)).filter((v) => !Number.isNaN(v)))
  const refU = refOf(REF_UPPER, m.capHeight)
  const refL = refOf(REF_LOWER, m.xHeight)
  const touching: Array<{ l: string; r: string; min: number }> = []
  const loose: Array<{ l: string; r: string; mean: number; ref: number; kern: number }> = []
  const test = (pairs: string[], top: number, ref: number) => {
    for (const p of pairs) {
      const [l, r] = [p[0]!, p[1]!]
      const a = g(l)
      const b = g(r)
      if (!a || !b) continue
      const k = kernFor(face, l, r)
      const res = pairGap(a, b, k, 0, top, BIG)
      if (res.rows === 0) continue
      if (res.min < NEAR_TOUCH) touching.push({ l, r, min: res.min })
      else if (ref > 0 && KERN_CLASSICS.includes(p) && res.mean / ref >= KERN_LOOSE_RATIO) {
        // Close the average gap toward the target, but never closer than the room the nearest approach allows.
        const keepAway = Math.max(MIN_AFTER, Math.round(ref * 0.35))
        const room = Math.floor((res.min - keepAway) / 5) * 5
        if (room < 10) continue // already as tight as it can safely get
        const wanted = Math.round((res.mean - KERN_TARGET * ref) / 5) * 5
        loose.push({ l, r, mean: res.mean, ref, kern: k - Math.min(room, wanted) })
      }
    }
  }
  test([...UPPER_PAIRS, ...KERN_CLASSICS], m.capHeight, refU)
  test(LOWER_PAIRS, m.xHeight, refL)
  if (touching.length) {
    out.push(
      finding({
        id: 'spacing.touching',
        severity: 'warning',
        category: 'spacing',
        title: 'Pairs that touch or nearly touch',
        detail: `The closest approach between neighbouring outlines is under ${NEAR_TOUCH} units for ${touching.map((t) => t.l + t.r).join(' ')}.`,
        evidence: touching.map((t) => `${t.l}${t.r}: ${t.min <= 0 ? `overlap of ${-t.min}` : `closest approach ${fmt(t.min)}`} units`),
        why: 'Ink that touches blobs together at small sizes and prints badly.',
        glyphs: [...new Set(touching.flatMap((t) => [t.l, t.r]))],
        fixes: [{ kind: 'edit', label: `Open up ${touching.map((t) => t.l + t.r).join(' ')} with kerning`, apply: (f) => touching.reduce((acc, t) => setKerning(acc, t.l, t.r, kernFor(acc, t.l, t.r) + Math.ceil((NEAR_TOUCH + 10 - t.min) / 5) * 5), f) }],
      }),
    )
  }
  if (loose.length) {
    out.push(
      finding({
        id: 'spacing.loose-pairs',
        severity: 'recommendation',
        category: 'spacing',
        title: 'Pairs that usually need kerning',
        detail: `${loose.map((t) => t.l + t.r).join(' ')} leave a gap of more than ${KERN_LOOSE_RATIO}× the gap between straight stems. Designers conventionally kern combinations like these.`,
        evidence: loose.map((t) => `${t.l}${t.r}: average gap ${fmt(t.mean)} vs ${fmt(t.ref)} between straight stems (${fmt(t.mean / t.ref)}×); suggested kerning ${t.kern}`),
        why: 'Without kerning these pairs show as holes in words such as “TAV” or “LY”. The kerning is stored in the font (GPOS) and applied by programs that support it.',
        glyphs: [...new Set(loose.flatMap((t) => [t.l, t.r]))],
        fixes: [{ kind: 'edit', label: `Add the suggested kerning for ${loose.map((t) => t.l + t.r).join(' ')}`, apply: (f) => loose.reduce((acc, t) => setKerning(acc, t.l, t.r, t.kern), f) }, { kind: 'go', label: 'Look at them in the preview', view: 'preview', text: loose.map((t) => t.l + t.r).join(' ') }],
      }),
    )
  }
  const extreme = face.kerning.filter((k) => Math.abs(k.value) > 250)
  if (extreme.length) {
    out.push(finding({ id: 'spacing.extreme-kerning', severity: 'warning', category: 'spacing', title: 'Very large kerning values', detail: 'A kerning value of more than a quarter of an em moves the next letter very far.', evidence: extreme.map((k) => `${k.left}${k.right}: ${k.value}`), why: 'This is usually a typo, and it can make letters overlap.', fixes: extreme.map((k) => ({ kind: 'edit' as const, label: `Remove kerning for ${k.left}${k.right}`, apply: (f: CustomTypeface) => setKerning(f, k.left, k.right, 0) })).slice(0, 3) }))
  }
  const dangling = face.kerning.filter((k) => !g(k.left) || !g(k.right))
  if (dangling.length) {
    out.push(finding({ id: 'kerning.missing-glyph', severity: 'warning', category: 'spacing', title: 'Kerning for glyphs that are not in the font', detail: 'These pairs refer to a character that is not in the font and are skipped on export.', evidence: dangling.map((k) => `${k.left}${k.right}: ${k.value}`), why: 'The values have no effect.', fixes: [{ kind: 'edit', label: 'Remove these pairs', apply: (f) => dangling.reduce((acc, k) => setKerning(acc, k.left, k.right, 0), f) }] }))
  }
  return out
}

/* ---------- 7. metadata ---------- */

function metadata(ctx: Ctx): QualityFinding[] {
  const out: QualityFinding[] = []
  const { face } = ctx
  const name = face.familyName.trim()
  if (!name) out.push(finding({ id: 'metadata.family', severity: 'blocking', category: 'metadata', title: 'No family name', detail: 'A font needs a family name.', why: 'Programs list fonts by family name.', fixes: [goInfo('Enter a family name')] }))
  else {
    if (/^Untitled\b/.test(name)) out.push(finding({ id: 'metadata.placeholder-name', severity: 'warning', category: 'metadata', title: 'Placeholder family name', detail: `The family name is still “${name}”.`, why: 'Every font named like this looks the same in a font menu, and installing two replaces one with the other.', fixes: [goInfo('Name your typeface')] }))
    if (name.length > 31) out.push(finding({ id: 'metadata.long-name', severity: 'recommendation', category: 'metadata', title: 'Long family name', detail: `The family name has ${name.length} characters.`, evidence: [`Older Windows programs and some font menus cut names at 31 characters.`], why: 'The name may be truncated in some programs.', fixes: [goInfo('Shorten the family name')] }))
    const stripped = name.replace(/[^A-Za-z0-9]/g, '')
    if (!stripped) out.push(finding({ id: 'metadata.ps-name', severity: 'warning', category: 'metadata', title: 'The family name has no letters or digits usable in a PostScript name', detail: 'The PostScript name is built from the family name using only letters, digits and hyphens.', why: 'Many tools identify fonts by PostScript name; an empty one makes the font hard to tell apart.', fixes: [goInfo('Add Latin letters or digits to the family name')] }))
    else if (stripped.length < name.replace(/\s/g, '').length) out.push(finding({ id: 'metadata.ps-name-stripped', severity: 'recommendation', category: 'metadata', title: 'Some characters of the name are not used in the PostScript name', detail: `The PostScript name will be built from “${name}” with other characters removed.`, why: 'It is only a technical identifier; the full family name is kept for menus.' }))
  }
  if (face.styleName !== 'Regular') {
    out.push(finding({ id: 'metadata.style', severity: 'warning', category: 'metadata', title: `Style name “${face.styleName}” does not match the font’s style flags`, detail: 'This version writes the font as Regular (weight 400, upright). The style flags in the file stay Regular whatever the name says.', why: 'Programs group bold and italic fonts using those flags; a name that disagrees with them causes confusing menus.', fixes: [{ kind: 'edit', label: 'Set the style name to Regular', apply: (f) => ({ ...f, styleName: 'Regular' }) }] }))
  }
  if (!face.copyright.trim()) {
    out.push(finding({ id: 'metadata.copyright', severity: 'warning', category: 'metadata', title: 'No copyright notice', detail: 'The copyright field is empty, so the file carries no statement of who made it.', why: 'Copyright notices are conventional in font files and help others identify the author. The studio does not write one for you.', fixes: [goInfo('Add a copyright notice')] }))
  }
  const lic = face.license
  if (!lic.name.trim() || lic.name === LICENSE_PLACEHOLDER) {
    out.push(finding({ id: 'metadata.license', severity: 'warning', category: 'metadata', title: 'No licence chosen', detail: 'No licence is set, so the exported file will carry no licence information.', why: 'Without a licence, people who receive the font cannot know what they may do with it. The choice is yours; the studio does not give legal advice.', fixes: [goInfo('Choose a licence')] }))
  } else {
    if (!lic.verified) out.push(finding({ id: 'metadata.license-unverified', severity: 'recommendation', category: 'metadata', title: 'Licence not confirmed', detail: `The licence “${lic.name}” is written into the file, but you have not confirmed it.`, why: 'The studio never assumes a licence is right; confirming it records that a person decided.', fixes: [goInfo('Confirm the licence')] }))
    if (!lic.url) out.push(finding({ id: 'metadata.license-url', severity: 'recommendation', category: 'metadata', title: 'No licence link', detail: 'The licence has a name but no URL.', why: 'A link lets people read the full text.', fixes: [goInfo('Add a licence link')] }))
  }
  return out
}

/* ---------- registry ---------- */

interface Check {
  info: CheckInfo
  run: (ctx: Ctx) => QualityFinding[]
}

export const CHECKS: Check[] = [
  { info: { id: 'coverage', category: 'coverage', name: 'Missing glyphs', measures: 'Which of the 95 target ASCII characters have a glyph that passes validation.', limits: 'Only the target set is checked. Accents and other scripts are out of scope.' }, run: coverage },
  { info: { id: 'geometry', category: 'outlines', name: 'Empty or invalid paths', measures: 'Every contour: point count, whole-unit coordinates, area, crossing edges, direction, counters inside shapes, ink inside the vertical metrics, bearings against the advance, stray specks and stacked points.', limits: 'Geometry only. It cannot tell whether a shape looks good or is legible.' }, run: geometry },
  { info: { id: 'mapping', category: 'mapping', name: 'Duplicate or invalid glyph mappings', measures: 'Unique code points, unique and valid glyph names, valid Unicode scalar values.', limits: 'Checked on the design. The exported file is compared again in the file checks.' }, run: mapping },
  { info: { id: 'alignment', category: 'metrics', name: 'Metric consistency', measures: 'Baseline, cap height, x-height and ascender alignment of letters and digits, and whether the declared x-height and cap height match the letters.', limits: 'Reference shapes are fixed lists of Latin letters; unusual designs may trip them. Allowed overshoot comes from your design settings.' }, run: (c) => [...alignment(c), ...parameters(c)] },
  { info: { id: 'widths', category: 'widths', name: 'Unusual advance widths', measures: 'Each glyph’s advance against the median of its group (uppercase, lowercase, digits), with allowances for narrow and wide letters, and the space against lowercase.', limits: 'A statistical outlier is a prompt to look, not a mistake: some designs are deliberately uneven.' }, run: widths },
  { info: { id: 'spacing', category: 'spacing', name: 'Suspicious spacing', measures: 'Side bearings of overridden glyphs against automatic spacing, the closest approach and the average gap in about 40 letter pairs (sampled every 8 units of height), compared with the gap between straight stems.', limits: 'Gaps are measured, not seen: optical spacing depends on weight, size and taste. Kerning suggestions are a starting point to check in the preview.' }, run: spacing },
  { info: { id: 'metadata', category: 'metadata', name: 'Missing metadata', measures: 'Family and style names, copyright and licence fields.', limits: 'The studio checks that fields exist and are consistent. It cannot judge whether a licence or copyright statement is legally right.' }, run: metadata },
]

const FILE_CHECK: CheckInfo = { id: 'file', category: 'file', name: 'Exported file checks', measures: 'The finished file is built, opened again and compared with the design: signature, tables, checksums, every character mapping, advance widths, outline bounds, metrics, names and kerning, plus the exporter library’s own validator.', limits: 'Run on this browser’s build of the file. Other programs may still behave differently; see the validation notes for what was tested where.' }

export interface FileCheckInput {
  issues: ValidationIssue[]
  format: string
}

const SEVERITY_ORDER: Record<QualitySeverity, number> = { blocking: 0, warning: 1, recommendation: 2 }

export function runQualityChecks(face: CustomTypeface, file?: FileCheckInput): QualityReport {
  const ctx = buildContext(face)
  const findings = CHECKS.flatMap((c) => c.run(ctx))
  if (file) {
    for (const i of file.issues) {
      if (i.severity === 'info') continue
      findings.push(
        finding({
          id: i.code,
          severity: i.severity === 'error' ? 'blocking' : 'warning',
          category: 'file',
          title: i.severity === 'error' ? `The ${file.format} file fails a check` : `The ${file.format} file has a warning`,
          detail: i.message,
          why: i.severity === 'error' ? 'The studio will not offer a file that fails its own checks.' : 'The file can be exported; check this in the programs you use.',
          glyphs: i.glyph ? [i.glyph] : [],
        }),
      )
    }
  }
  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const counts: Record<QualitySeverity, number> = { blocking: 0, warning: 0, recommendation: 0 }
  for (const f of findings) counts[f.severity] += 1
  return { findings, counts, checks: [...CHECKS.map((c) => c.info), FILE_CHECK], fileChecked: !!file }
}
