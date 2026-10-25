/**
 * The font file formats this app can really produce. A format is listed here only after the bytes it
 * produces pass the structural checks, read back through independent parsers (see docs/font-export-validation.md).
 * Not shipped, on purpose: WOFF and WOFF2 (the library can write them, but its win-metrics patch step cannot be
 * applied to a compressed container and they are not validated here), variable fonts and colour fonts.
 */
export type FontFormatId = 'ttf' | 'otf'

export interface FontFormat {
  id: FontFormatId
  label: string
  extension: '.ttf' | '.otf'
  mimeType: 'font/ttf' | 'font/otf'
  /** What the outlines are made of. */
  outlines: 'TrueType quadratic (glyf)' | 'PostScript/CFF (CFF )'
  /** First four bytes of a correct file. */
  magic: readonly number[]
  requiredTables: readonly string[]
  /** ExportRecord.kind in the project history. */
  kind: 'font-ttf' | 'font-otf'
}

const COMMON = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post']

export const FORMATS: Record<FontFormatId, FontFormat> = {
  ttf: { id: 'ttf', label: 'TrueType (.ttf)', extension: '.ttf', mimeType: 'font/ttf', outlines: 'TrueType quadratic (glyf)', magic: [0x00, 0x01, 0x00, 0x00], requiredTables: [...COMMON, 'glyf', 'loca'], kind: 'font-ttf' },
  otf: { id: 'otf', label: 'OpenType, CFF outlines (.otf)', extension: '.otf', mimeType: 'font/otf', outlines: 'PostScript/CFF (CFF )', magic: [0x4f, 0x54, 0x54, 0x4f], requiredTables: [...COMMON, 'CFF '], kind: 'font-otf' },
}

export const FORMAT_IDS = Object.keys(FORMATS) as FontFormatId[]

export type SniffedFormat = FontFormatId | 'woff' | 'woff2' | 'collection' | 'unknown'

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
