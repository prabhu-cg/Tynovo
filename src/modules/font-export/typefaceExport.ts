import type { ExportRecord, Project } from '@/modules/brand-projects/schema'
import { validateFontBinary, validateTypeface, type ValidationSummary } from '@/modules/font-validation/validate'
import { sha256Hex } from './download'
import { fontFluxBuilder } from './fontFluxBuilder'
import type { FontBuildResult } from './types'

export type TypefaceExport =
  | { ok: true; build: FontBuildResult; model: ValidationSummary; binary: ValidationSummary; record: ExportRecord }
  | { ok: false; model: ValidationSummary }

/**
 * Validate the model, build the font, validate the produced bytes, and prepare the history entry.
 * Never produces a file when the model has errors, and never reports success if the binary has errors.
 */
export async function exportTypeface(project: Project, newId: () => string, now: () => Date): Promise<TypefaceExport> {
  const face = project.customTypeface
  if (!face) throw new Error('Project has no custom typeface.')
  const model = validateTypeface(face)
  if (!model.exportable) return { ok: false, model }

  const stamp = now()
  const build = await fontFluxBuilder.build({ typeface: face, timestamp: stamp.toISOString(), version: '1.000' })
  const binary = await validateFontBinary(build.bytes)
  if (!binary.exportable) return { ok: false, model: { ...model, issues: [...model.issues, ...binary.issues], errorCount: model.errorCount + binary.errorCount, exportable: false } }

  const record: ExportRecord = {
    id: newId(),
    kind: 'font-ttf',
    at: stamp.toISOString(),
    filename: build.filename,
    bytes: build.bytes.byteLength,
    sha256: await sha256Hex(build.bytes),
  }
  return { ok: true, build, model, binary, record }
}
