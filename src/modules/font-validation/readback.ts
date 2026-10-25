import type { Contour, CustomTypeface } from '../brand-projects/schema'
import { FORMATS, sniffFormat, type FontFormatId } from '../font-export/formats'
import { loadFontFlux } from '../font-export/loadFontFlux'
import { psName } from '../font-export/fontFluxBuilder'
import { readDirectory, verifyChecksums } from '../font-export/sfnt'
import { contoursBounds, signedArea } from '../glyph-editor/geometry'
import { deriveMetrics } from '../typeface-engine/dna'
import { LICENSE_PLACEHOLDER } from '../typeface-engine/typeface'
import { analyzeTypeface } from './coverage'
import type { ValidationIssue } from './validate'

export interface ReadbackReport {
  issues: ValidationIssue[]
  /** Plain statements of what was checked and held, shown to the user as evidence. */
  passed: string[]
}

interface Point { x: number; y: number }
const asContour = (points: Point[]): Contour => points.map((p) => ({ x: p.x, y: p.y, onCurve: true }))
const inkArea = (contours: Contour[]) => contours.reduce((s, c) => s + Math.abs(signedArea(c)), 0)

/**
 * Open the produced bytes again and compare what is really in the file with what the project says should be
 * there: the signature, the tables and their checksums, every character mapping, advance widths, outline
 * bounds, vertical metrics and the name table. A mismatch is an error, because the file would not be the font
 * the person designed. The checks read the file through the table directory and Font Flux's reader; tests also
 * read the same files with fontkit and fontTools.
 */
export async function verifyFontBytes(bytes: Uint8Array, face: CustomTypeface, format: FontFormatId, version: string): Promise<ReadbackReport> {
  const issues: ValidationIssue[] = []
  const passed: string[] = []
  const err = (code: string, message: string, glyph?: string) => issues.push({ severity: 'error', code: `binary.${code}`, message, source: 'binary', ...(glyph ? { glyph } : {}) })
  const warn = (code: string, message: string) => issues.push({ severity: 'warning', code: `binary.${code}`, message, source: 'binary' })
  const spec = FORMATS[format]

  // 1. What the file really is
  const sniffed = sniffFormat(bytes)
  if (sniffed !== format) {
    err('format-mismatch', `The file should be ${spec.label} but its signature says ${sniffed}.`)
    return { issues, passed }
  }
  passed.push(`File signature is ${format === 'ttf' ? 'TrueType (00 01 00 00)' : 'OpenType/CFF (“OTTO”)'}, matching the ${spec.extension} extension and the ${spec.mimeType} type.`)

  // 2. Tables and checksums
  const dir = readDirectory(bytes)
  if (!dir) {
    err('directory', 'The table directory cannot be read.')
    return { issues, passed }
  }
  const have = new Set(dir.tables.map((t) => t.tag))
  const missingTables = spec.requiredTables.filter((t) => !have.has(t))
  if (missingTables.length) err('tables', `Required tables are missing: ${missingTables.join(', ')}.`)
  else passed.push(`All ${spec.requiredTables.length} required tables are present (${spec.requiredTables.join(', ')}).`)
  const sums = verifyChecksums(bytes)
  if (sums && (sums.problems.length || !sums.wholeFileOk)) {
    err('checksum', `Checksum mismatch${sums.problems.length ? ` in ${sums.problems.map((p) => p.table).join(', ')}` : ' for the whole file'}. Some programs reject such files.`)
  } else passed.push('Every table checksum and the whole-file checksum are correct.')

  // 3. Re-open and compare content
  const { FontFlux } = await loadFontFlux()
  let font: InstanceType<typeof FontFlux>
  try {
    font = FontFlux.open(bytes)
  } catch (e) {
    err('reopen', `The file cannot be opened again: ${e instanceof Error ? e.message : String(e)}`)
    return { issues, passed }
  }

  const expected = analyzeTypeface(face).supported
  const m = deriveMetrics(face.dna)
  const byUnicode = new Map<number, ReturnType<typeof font.listGlyphs>[number]>()
  const names = new Set<string>()
  for (const g of font.listGlyphs()) {
    if (names.has(g.name)) err('duplicate-name', `Two glyphs are named “${g.name}”.`)
    names.add(g.name)
    if (g.unicode !== null) {
      if (byUnicode.has(g.unicode)) err('duplicate-mapping', `Code point U+${g.unicode.toString(16).toUpperCase().padStart(4, '0')} maps to more than one glyph.`)
      byUnicode.set(g.unicode, g)
    }
  }
  if (font.listGlyphs()[0]?.name !== '.notdef') err('notdef', 'Glyph 0 is not .notdef; text with unsupported characters would not show the fallback box.')

  let wrongMapping = 0
  let wrongAdvance = 0
  let wrongShape = 0
  let wrongBearing = 0
  for (const g of expected) {
    const label = g.char === ' ' ? 'space' : g.char
    const cp = g.char.codePointAt(0)!
    const found = byUnicode.get(cp)
    if (!found) {
      err('unmapped', `Character ${label} is not mapped to any glyph in the file.`, label)
      wrongMapping += 1
      continue
    }
    if (found.name !== g.name) {
      err('mapping', `Character ${label} maps to glyph “${found.name}”, expected “${g.name}”.`, label)
      wrongMapping += 1
    }
    const read = font.getGlyph(found.name)
    if (!read) continue
    if (read.advanceWidth !== g.advanceWidth) {
      err('advance', `Advance width of ${label} is ${read.advanceWidth} in the file but ${g.advanceWidth} in the design.`, label)
      wrongAdvance += 1
    }
    const readContours = (font.getGlyphContours(found.name) as Point[][]).map(asContour).filter((c) => c.length >= 3) // CFF reads an empty glyph as a lone moveto
    const a = contoursBounds(g.contours)
    const b = contoursBounds(readContours)
    // The side bearing in hmtx must equal where the ink starts, or renderers disagree about where it is drawn.
    if (a && read.leftSideBearing !== a.minX) {
      err('side-bearing', `The left side bearing of ${label} in the file is ${read.leftSideBearing} but its outline starts at ${a.minX}; browsers would draw it ${a.minX - (read.leftSideBearing ?? 0)} units off.`, label)
      wrongBearing += 1
    }
    const sameBounds = (!a && !b) || (a && b && a.minX === b.minX && a.minY === b.minY && a.maxX === b.maxX && a.maxY === b.maxY)
    const sameShape = readContours.length === g.contours.length && Math.abs(inkArea(readContours) - inkArea(g.contours)) < 1
    if (!sameBounds || !sameShape) {
      err('outline', `The outline of ${label} in the file differs from the design (bounds or contour area).`, label)
      wrongShape += 1
    }
  }
  const expectedCodes = new Set(expected.map((g) => g.char.codePointAt(0)!))
  const extra = [...byUnicode.keys()].filter((c) => !expectedCodes.has(c))
  if (extra.length) err('extra-mapping', `The file maps ${extra.length} character${extra.length > 1 ? 's' : ''} that the design does not include.`)
  if (font.glyphCount !== expected.length + 1) err('glyph-count', `The file has ${font.glyphCount} glyphs; expected ${expected.length} plus .notdef.`)
  if (!wrongMapping && !wrongAdvance && !wrongShape && !wrongBearing && !extra.length && font.glyphCount === expected.length + 1) {
    passed.push(`${expected.length} characters map to ${expected.length} glyphs with the expected names; advance widths, side bearings and outline bounds match the design. No extra or duplicate mappings; .notdef is glyph 0.`)
  }

  // Kerning pairs between glyphs that are in the font
  const present = new Map(expected.map((g) => [g.char, g.name]))
  let kernOk = 0
  for (const k of face.kerning) {
    const l = present.get(k.left)
    const r = present.get(k.right)
    if (!l || !r) continue
    if (font.getKerning(l, r) !== k.value) err('kerning', `Kerning for “${k.left}${k.right}” is ${font.getKerning(l, r) ?? 'missing'} in the file but ${k.value} in the design.`)
    else kernOk += 1
  }
  if (kernOk > 0 && !issues.some((i) => i.code === 'binary.kerning')) passed.push(`${kernOk} kerning pair${kernOk > 1 ? 's are' : ' is'} in the file with the designed value${kernOk > 1 ? 's' : ''}.`)

  // 4. Metrics
  const info = font.info
  const os2 = dir.tables.find((t) => t.tag === 'OS/2')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let metricsOk = info.unitsPerEm === m.unitsPerEm && info.ascender === m.ascender && info.descender === m.descender
  if (!metricsOk) err('metrics', `Vertical metrics in the file (${info.ascender}/${info.descender} per ${info.unitsPerEm}) differ from the design (${m.ascender}/${m.descender} per ${m.unitsPerEm}).`)
  if (os2 && os2.length >= 90) {
    const winAscent = view.getUint16(os2.offset + 74)
    const winDescent = view.getUint16(os2.offset + 76)
    if (winAscent !== m.ascender || winDescent !== Math.abs(m.descender)) {
      metricsOk = false
      warn('win-metrics', `Windows ascent/descent are ${winAscent}/${winDescent}, not ${m.ascender}/${Math.abs(m.descender)}; line spacing may differ in older Windows programs.`)
    }
  }
  if (metricsOk) passed.push(`Units per em ${m.unitsPerEm}, ascender ${m.ascender}, descender ${m.descender} and the Windows metrics match the design.`)

  // 5. Names and metadata
  const nameProblems: string[] = []
  if (info.familyName !== face.familyName) nameProblems.push(`family “${info.familyName}” (expected “${face.familyName}”)`)
  if (info.styleName !== face.styleName) nameProblems.push(`style “${info.styleName}” (expected “${face.styleName}”)`)
  if (info.postScriptName !== psName(face.familyName, face.styleName)) nameProblems.push(`PostScript name “${info.postScriptName}”`)
  if (face.copyright && info.copyright !== face.copyright) nameProblems.push('copyright')
  if (face.license.name && face.license.name !== LICENSE_PLACEHOLDER && info.license !== face.license.name) nameProblems.push('licence name')
  if (face.license.url && info.licenseURL !== face.license.url) nameProblems.push('licence URL')
  if (info.version !== `Version ${version}`) nameProblems.push(`version “${info.version}”`)
  if (nameProblems.length) err('names', `Name table differs from the project: ${nameProblems.join(', ')}.`)
  else passed.push(`Name table matches the project: family “${info.familyName}”, style “${info.styleName}”, PostScript name ${info.postScriptName}, ${info.version}${face.copyright ? ', copyright' : ''}${face.license.name && face.license.name !== LICENSE_PLACEHOLDER ? ', licence' : ''}.`)

  return { issues, passed }
}
