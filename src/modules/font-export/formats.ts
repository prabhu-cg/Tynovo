/**
 * The font file formats this app can really produce. A format is listed here only after the bytes it
 * produces pass the structural checks, read back through independent parsers (see docs/font-export-validation.md).
 * WOFF and WOFF2 are the validated TrueType file in a compressed container (container.ts), checked by reading the
 * container back and by an independent decoder. Not shipped, on purpose: variable fonts and colour fonts.
 */
export type FontFormatId = 'ttf' | 'otf' | 'woff' | 'woff2'

export interface FontFormat {
  id: FontFormatId
  label: string
  extension: '.ttf' | '.otf' | '.woff' | '.woff2'
  mimeType: 'font/ttf' | 'font/otf' | 'font/woff' | 'font/woff2'
  /** What the outlines are made of. */
  outlines: 'TrueType quadratic (glyf)' | 'PostScript/CFF (CFF )'
  /** First four bytes of a correct file. */
  magic: readonly number[]
  /** Tables the font inside must have (for a web font, the ones in its container). */
  requiredTables: readonly string[]
  /** ExportRecord.kind in the project history. */
  kind: 'font-ttf' | 'font-otf' | 'font-woff' | 'font-woff2'
  /** True for WOFF and WOFF2: a compressed container around a TrueType font. */
  container: boolean
}

const COMMON = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post']

export const FORMATS: Record<FontFormatId, FontFormat> = {
  ttf: { id: 'ttf', label: 'TrueType (.ttf)', extension: '.ttf', mimeType: 'font/ttf', outlines: 'TrueType quadratic (glyf)', magic: [0x00, 0x01, 0x00, 0x00], requiredTables: [...COMMON, 'glyf', 'loca'], kind: 'font-ttf', container: false },
  otf: { id: 'otf', label: 'OpenType, CFF outlines (.otf)', extension: '.otf', mimeType: 'font/otf', outlines: 'PostScript/CFF (CFF )', magic: [0x4f, 0x54, 0x54, 0x4f], requiredTables: [...COMMON, 'CFF '], kind: 'font-otf', container: false },
  woff: { id: 'woff', label: 'WOFF (.woff)', extension: '.woff', mimeType: 'font/woff', outlines: 'TrueType quadratic (glyf)', magic: [0x77, 0x4f, 0x46, 0x46], requiredTables: [...COMMON, 'glyf', 'loca'], kind: 'font-woff', container: true },
  woff2: { id: 'woff2', label: 'WOFF2 (.woff2)', extension: '.woff2', mimeType: 'font/woff2', outlines: 'TrueType quadratic (glyf)', magic: [0x77, 0x4f, 0x46, 0x32], requiredTables: [...COMMON, 'glyf', 'loca'], kind: 'font-woff2', container: true },
}

export const FORMAT_IDS = Object.keys(FORMATS) as FontFormatId[]

export type SniffedFormat = FontFormatId | 'collection' | 'unknown'

/** What the bytes really are, from the file signature. */
export function sniffFormat(bytes: Uint8Array): SniffedFormat {
  const tag = String.fromCharCode(...bytes.slice(0, 4))
  if (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) return 'ttf'
  if (tag === 'OTTO') return 'otf'
  if (tag === 'wOFF') return 'woff'
  if (tag === 'wOF2') return 'woff2'
  if (tag === 'ttcf') return 'collection'
  return 'unknown'
}

/** Never hand over a file whose content is not the format its name and type claim. */
export function assertBytesAre(bytes: Uint8Array, format: FontFormatId): void {
  const actual = sniffFormat(bytes)
  if (actual !== format) throw new Error(`The file would be named ${FORMATS[format].extension} but its content is ${actual}. Nothing was exported.`)
}
