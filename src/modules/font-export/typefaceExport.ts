import type { ExportRecord, Project } from '@/modules/brand-projects/schema'
import { verifyFontBytes } from '@/modules/font-validation/readback'
import { validateFontBinary, validateTypeface, type ValidationIssue, type ValidationSummary } from '@/modules/font-validation/validate'
import { sha256Hex } from './download'
import { fontFluxBuilder } from './fontFluxBuilder'
import { FORMATS, type FontFormatId } from './formats'
import type { FontBuildResult } from './types'

export const FONT_VERSION = '1.000'

export type TypefaceExport =
  | { ok: true; format: FontFormatId; build: FontBuildResult; model: ValidationSummary; binary: ValidationSummary; passed: string[]; record: ExportRecord }
  /** No file is offered. `stage` says where it stopped, `model` holds every reason. */
  | { ok: false; format: FontFormatId; stage: 'design' | 'build' | 'file'; model: ValidationSummary }

const summary = (issues: ValidationIssue[]): ValidationSummary => {
  const errorCount = issues.filter((i) => i.severity === 'error').length
  return { issues, errorCount, warningCount: issues.filter((i) => i.severity === 'warning').length, exportable: errorCount === 0 }
}

/**
 * Validate the design, build the font, read the produced bytes back and compare them with the design, and
 * prepare the history entry. No file is offered when the design has errors, when building throws, or when the
 * produced file fails any check; the project is never touched.
 */
export async function exportTypeface(project: Project, newId: () => string, now: () => Date, format: FontFormatId = 'ttf', sourceRevision?: string): Promise<TypefaceExport> {
  const face = project.customTypeface
  if (!face) throw new Error('Project has no custom typeface.')
  const model = validateTypeface(face)
  if (!model.exportable) return { ok: false, format, stage: 'design', model }

  const stamp = now()
  let build: FontBuildResult
  try {
    build = await fontFluxBuilder.build({ typeface: face, timestamp: stamp.toISOString(), version: FONT_VERSION, format })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, format, stage: 'build', model: summary([...model.issues, { severity: 'error', code: 'export.build-failed', message: `The ${FORMATS[format].label} file could not be built: ${message}`, source: 'binary' }]) }
  }

  let binary: ValidationSummary
  let passed: string[] = []
  try {
    const [lib, read] = await Promise.all([validateFontBinary(build.bytes), verifyFontBytes(build.bytes, face, format, FONT_VERSION)])
    binary = summary([...lib.issues, ...read.issues])
    passed = read.passed
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    binary = summary([{ severity: 'error', code: 'export.check-failed', message: `The finished file could not be checked: ${message}`, source: 'binary' }])
  }
  if (!binary.exportable) return { ok: false, format, stage: 'file', model: summary([...model.issues, ...binary.issues]) }

  const record: ExportRecord = {
    id: newId(),
    kind: FORMATS[format].kind,
    at: stamp.toISOString(),
    filename: build.filename,
    bytes: build.bytes.byteLength,
    sha256: await sha256Hex(build.bytes),
    ...(sourceRevision ? { sourceRevision } : {}),
  }
  return { ok: true, format, build, model, binary, passed, record }
}
