import type { CustomTypeface, Glyph } from '../brand-projects/schema'
import { glyphName, GROUPS, TARGET_CHARS, type CharGroup } from '../typeface-engine/charset'
import { deriveMetrics } from '../typeface-engine/dna'
import { generateTypeface } from '../typeface-engine/generate'
import { validateGlyph, type GlyphIssue } from './glyphs'

/**
 * supported: a glyph exists and passes every geometric check.
 * invalid:   a glyph was generated but fails a check; it is excluded from export.
 * missing:   no glyph could be produced (no recipe yet, or the build failed).
 */
export type GlyphStatus = 'supported' | 'invalid' | 'missing'

export interface GlyphReport {
  char: string
  name: string
  status: GlyphStatus
  glyph: Glyph | null
  issues: GlyphIssue[]
  /** For missing glyphs: why. */
  reason?: 'no-recipe' | 'failed' | 'empty'
  message?: string
}

export interface GroupCoverage {
  id: CharGroup['id']
  label: string
  total: number
  supported: number
  invalid: string[]
  missing: string[]
}

export interface TypefaceAnalysis {
  reports: Map<string, GlyphReport>
  groups: GroupCoverage[]
  supported: Glyph[]
  total: number
  supportedCount: number
}

const memo = new WeakMap<object, TypefaceAnalysis>()

/** Generate every target glyph and classify it. Pure and memoised on the typeface object. */
export function analyzeTypeface(face: Pick<CustomTypeface, 'dna' | 'overrides'>): TypefaceAnalysis {
  const hit = memo.get(face)
  if (hit) return hit
  const metrics = deriveMetrics(face.dna)
  const gen = generateTypeface(face)
  const reports = new Map<string, GlyphReport>()
  for (const g of gen.glyphs) {
    const issues = validateGlyph(g, metrics)
    const bad = issues.some((i) => i.severity === 'error')
    reports.set(g.char, { char: g.char, name: g.name, status: bad ? 'invalid' : 'supported', glyph: g, issues })
  }
  for (const m of gen.missing) {
    reports.set(m.char, { char: m.char, name: glyphName(m.char), status: 'missing', glyph: null, issues: [], reason: m.reason, message: m.message })
  }
  const groups: GroupCoverage[] = GROUPS.map((grp) => {
    const chars = [...grp.chars]
    const status = (c: string) => reports.get(c)?.status
    return {
      id: grp.id,
      label: grp.label,
      total: chars.length,
      supported: chars.filter((c) => status(c) === 'supported').length,
      invalid: chars.filter((c) => status(c) === 'invalid'),
      missing: chars.filter((c) => status(c) === 'missing'),
    }
  })
  const supported = TARGET_CHARS.map((c) => reports.get(c)).filter((r): r is GlyphReport => r?.status === 'supported').map((r) => r.glyph!)
  const out: TypefaceAnalysis = { reports, groups, supported, total: TARGET_CHARS.length, supportedCount: supported.length }
  memo.set(face, out)
  return out
}

/** One line for UIs and documentation: derived, never hand-written. */
export function describeCoverage(a: TypefaceAnalysis): string {
  const parts = a.groups.filter((g) => g.id !== 'space').map((g) => `${g.supported} of ${g.total} ${g.label.split(' ')[0]!.toLowerCase()}`)
  return `${a.supportedCount} of ${a.total} target characters supported (${parts.join(', ')}).`
}
