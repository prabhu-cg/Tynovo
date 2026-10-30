import type { CustomTypeface } from '../brand-projects/schema'
import { innerSfnt } from '../font-export/container'
import { loadFontFlux } from '../font-export/loadFontFlux'
import { dnaIssues } from '../typeface-engine/dna'
import { ENGINE_VERSION } from '../typeface-engine/version'
import { analyzeTypeface, describeCoverage } from './coverage'
import type { Severity } from './glyphs'

export type { Severity } from './glyphs'

export interface ValidationIssue {
  severity: Severity
  code: string
  message: string
  glyph?: string
  source: 'model' | 'binary'
}

export interface ValidationSummary {
  issues: ValidationIssue[]
  errorCount: number
  warningCount: number
  /** True when there are no errors. This is not a quality score. */
  exportable: boolean
}

function summarise(issues: ValidationIssue[]): ValidationSummary {
  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length
  return { issues, errorCount, warningCount, exportable: errorCount === 0 }
}

/**
 * Checks on the editable model, before any bytes exist. Pure.
 * Glyphs that fail geometry checks are errors (they would be left out of the font, and silently shipping
 * a smaller font than the user thinks they have would be wrong). Characters with no glyph are warnings.
 */
export function validateTypeface(face: CustomTypeface): ValidationSummary {
  const issues: ValidationIssue[] = []
  const add = (severity: Severity, code: string, message: string, glyph?: string) =>
    issues.push({ severity, code, message, source: 'model', ...(glyph ? { glyph } : {}) })

  for (const i of dnaIssues(face.dna)) add(i.severity, i.code, i.message)
  if (face.engineVersion > ENGINE_VERSION) {
    add('warning', 'engine.newer', `This design was made with generator version ${face.engineVersion}; this app has version ${ENGINE_VERSION}, so glyphs may differ from what the design was made against.`)
  } else if (face.engineVersion < ENGINE_VERSION) {
    add('info', 'engine.older', `This design was made with generator version ${face.engineVersion}; glyphs are regenerated with version ${ENGINE_VERSION} and may differ slightly.`)
  }

  const analysis = analyzeTypeface(face)
  for (const r of analysis.reports.values()) {
    const label = r.char === ' ' ? 'space' : r.char
    if (r.status === 'invalid') {
      for (const gi of r.issues.filter((x) => x.severity === 'error')) add('error', gi.code, gi.message, label)
    }
    for (const gi of r.issues.filter((x) => x.severity !== 'error')) add(gi.severity, gi.code, gi.message, label)
  }
  const missing = analysis.groups.flatMap((g) => g.missing)
  if (missing.length > 0) {
    add('warning', 'coverage.missing', `${describeCoverage(analysis)} Not in the font: ${missing.map((c) => (c === ' ' ? 'space' : c)).join(' ')}`)
  }
  if (analysis.supportedCount === 0) add('error', 'font.no-glyphs', 'No glyph in this typeface passes validation, so there is nothing to export.')

  const have = new Set(analysis.supported.map((g) => g.char))
  for (const k of face.kerning) {
    if (!have.has(k.left) || !have.has(k.right)) {
      add('warning', 'kerning.missing-glyph', `Kerning pair "${k.left}${k.right}" refers to a glyph that is not in the font; it is skipped on export.`)
    }
  }
  if (!face.license.verified) add('info', 'license.unverified', 'The licence for this typeface has not been confirmed by the project owner.')
  return summarise(issues)
}

/** Checks on exported bytes, using the exporter library's structural validator on the final file. */
export async function validateFontBinary(bytes: Uint8Array): Promise<ValidationSummary> {
  const { FontFlux } = await loadFontFlux()
  // A web font is checked on the font inside its container; the container itself is checked by the read-back.
  const sfnt = await innerSfnt(bytes)
  const buffer = sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength) as ArrayBuffer
  const report = FontFlux.diagnose(buffer)
  const issues: ValidationIssue[] = report.issues.map((i) => ({
    severity: (i.severity as Severity) ?? 'info',
    code: String(i.code ?? 'binary'),
    message: String(i.message ?? ''),
    source: 'binary' as const,
  }))
  return summarise(issues)
}
