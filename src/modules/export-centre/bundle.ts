import { serializeProject, projectFilename, type Clock } from '@/modules/brand-projects/model'
import type { Project } from '@/modules/brand-projects/schema'
import { rolesUsingCustom } from '@/modules/brand-system/fonts'
import { fileStem } from '@/modules/brand-system/text'
import { contentRevision } from '@/modules/brand-system/revision'
import { sha256Hex } from '@/modules/font-export/download'
import { exportTypeface, type TypefaceExport } from '@/modules/font-export/typefaceExport'
import { buildCss, fontPath } from './css'
import { buildManifest } from './manifest'
import { buildSpec } from './spec'
import { buildSpecimen } from './specimen'
import { buildTokens } from './tokens'
import type { CustomFontFile, ExportFile, ExportFileId, ExportInput } from './types'
import { createZip } from './zip'

export interface ExportBundle {
  revision: string
  generatedAt: string
  files: Record<ExportFileId, ExportFile>
  /** Display order. */
  order: ExportFileId[]
  /** The font build and its checks, when the project has a typeface. */
  fontResult: TypefaceExport | null
}

const enc = new TextEncoder()

/**
 * Build every export from one saved project in one pass, so all of them describe the same content: the same
 * revision, the same role settings, and the very bytes of the font file that the CSS and the specimen refer to.
 * Pure apart from the font build; `now` and `newId` come from the caller.
 */
export async function buildBundle(project: Project, clock: Pick<Clock, 'now' | 'newId'>): Promise<ExportBundle> {
  const revision = await contentRevision(project)
  const generatedAt = clock.now().toISOString()
  const usesCustom = rolesUsingCustom(project).length > 0

  let fontResult: TypefaceExport | null = null
  let font: CustomFontFile | null = null
  if (project.customTypeface) {
    // The font's own timestamp is the project's creation time, so the same design always yields the same bytes.
    fontResult = await exportTypeface(project, clock.newId, () => new Date(project.createdAt), 'ttf')
    if (fontResult.ok) {
      font = { filename: fontResult.build.filename, bytes: fontResult.build.bytes, mimeType: fontResult.build.mimeType, format: 'ttf', sha256: fontResult.record.sha256 ?? (await sha256Hex(fontResult.build.bytes)) }
    }
  }
  const fontBlocked = usesCustom && font === null
  const input: ExportInput = { project, revision, generatedAt, font, fontBlocked }

  const text = (s: string) => enc.encode(s)
  const make = async (
    id: ExportFileId,
    path: string,
    title: string,
    description: string,
    mimeType: string,
    bytes: Uint8Array,
    kind: ExportFile['kind'],
    unavailableReason?: string,
  ): Promise<ExportFile> => ({
    id, path, title, description, mimeType, bytes, kind,
    sha256: await sha256Hex(bytes),
    available: unavailableReason === undefined,
    ...(unavailableReason !== undefined ? { unavailableReason } : {}),
  })
  const needsFont = fontBlocked ? 'The custom typeface has errors, so its font file cannot be built, and this file would refer to a file that does not exist. Fix the typeface first.' : undefined

  const spec = await make('spec', 'typography-spec.md', 'Typography specification', 'Brand, type scale, roles, fonts, licences and checks, as Markdown.', 'text/markdown', text(buildSpec(input)), 'spec-md')
  const tokens = await make('tokens', 'tokens.json', 'Design tokens (JSON)', 'Scale, font families and role typography in the Design Tokens format.', 'application/json', text(buildTokens(input)), 'tokens-json')
  const css = await make('css', 'typography.css', 'CSS variables and font declarations', 'Custom properties and classes for every role, plus @font-face for your typeface.', 'text/css', text(buildCss(input)), 'tokens-css', needsFont)
  const specimen = await make('specimen', 'specimen.html', 'HTML specimen', 'One self-contained page showing every role in its font. Your typeface is embedded.', 'text/html', text(buildSpecimen(input)), 'specimen', needsFont)
  const backup = await make('project', projectFilename(project), 'Project file (backup)', 'The whole project as JSON. Opens again in the studio.', 'application/json', text(serializeProject(project, { now: () => new Date(generatedAt), newId: clock.newId })), 'project-json')
  const fontFile: ExportFile = font
    ? await make('font', font.filename, 'Custom font file (TTF)', 'Your typeface as a checked TrueType file. OpenType/CFF is available below.', font.mimeType, font.bytes, 'font-ttf')
    : await make('font', 'font.ttf', 'Custom font file (TTF)', 'Your typeface as a checked TrueType file.', 'font/ttf', new Uint8Array(), 'font-ttf', project.customTypeface ? 'The typeface has errors that block export.' : 'This project has no custom typeface.')

  const listed = [css, tokens, spec, specimen, backup, ...(font ? [fontFile] : [])]
  const manifestInput = listed.map((f) => ({ path: f.id === 'font' ? fontPath(f.path) : f.path, bytes: f.bytes.length, sha256: f.sha256 }))
  const manifest = await make('manifest', 'SOURCES-AND-LICENSES.md', 'Sources and licences', 'Where each font comes from, its licence, and whether its file is included.', 'text/markdown', text(buildManifest(input, manifestInput)), 'manifest')

  const entries = [...listed, manifest].filter((f) => f.available).map((f) => ({ path: f.id === 'font' ? fontPath(f.path) : f.path, bytes: f.bytes }))
  const zip = await make('package', `${fileStem(project.name)}-typography.zip`, 'Everything, as one package', 'Every file below, in a folder layout where the CSS finds the font file.', 'application/zip', createZip(entries, new Date(generatedAt)), 'package', needsFont)

  const files = { spec, tokens, css, specimen, manifest, project: backup, font: fontFile, package: zip }
  return { revision, generatedAt, files, order: ['spec', 'tokens', 'css', 'specimen', 'manifest', 'font', 'project', 'package'], fontResult }
}
