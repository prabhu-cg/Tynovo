// @vitest-environment node
import { mkdirSync, writeFileSync } from 'node:fs'
import * as fontkit from 'fontkit'
import { verifyFontBytes } from '@/modules/font-validation/readback'
import { validateFontBinary } from '@/modules/font-validation/validate'
import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { signedArea } from '@/modules/glyph-editor/geometry'
import { setGlyphOutline } from '@/modules/typeface-engine/edit'
import { createTypeface } from '@/modules/typeface-engine/typeface'
import { fontFluxBuilder } from './fontFluxBuilder'
import { assertBytesAre, FORMATS, FORMAT_IDS, sniffFormat } from './formats'
import { readDirectory, verifyChecksums } from './sfnt'
import { exportTypeface } from './typefaceExport'
import type { Project } from '@/modules/brand-projects/schema'
import { createProject } from '@/modules/brand-projects/model'

const TIMESTAMP = '2026-03-04T05:06:07.000Z'
const face = () => {
  const t = createTypeface('f1', 'rounded', 'Format Test')
  t.copyright = 'Copyright 2026 Example Studio'
  t.license = { name: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org', verified: true }
  return t
}
const build = (format: 'ttf' | 'otf', typeface = face()) => fontFluxBuilder.build({ typeface, timestamp: TIMESTAMP, version: '1.002', format })

describe.each(FORMAT_IDS)('%s export', (format) => {
  const spec = FORMATS[format]

  it('has the right extension, MIME type and file signature, and says what it is', async () => {
    const r = await build(format)
    expect(r.filename).toBe(`FormatTest-Regular${spec.extension}`)
    expect(r.mimeType).toBe(spec.mimeType)
    expect(r.format).toBe(format)
    expect(sniffFormat(r.bytes)).toBe(format)
    expect([...r.bytes.slice(0, 4)]).toEqual([...spec.magic])
  })

  it('contains every required table and has correct checksums', async () => {
    const r = await build(format)
    const tags = readDirectory(r.bytes)!.tables.map((t) => t.tag)
    for (const t of spec.requiredTables) expect(tags, t).toContain(t)
    const sums = verifyChecksums(r.bytes)!
    expect(sums.problems).toEqual([])
    expect(sums.wholeFileOk).toBe(true)
  })

  it('passes the library validator and our read-back comparison with the design', async () => {
    const r = await build(format)
    expect((await validateFontBinary(r.bytes)).errorCount).toBe(0)
    const report = await verifyFontBytes(r.bytes, face(), format, '1.002')
    expect(report.issues).toEqual([])
    expect(report.passed.length).toBeGreaterThanOrEqual(5)
  })

  it('is read correctly by an independent parser (fontkit): names, mappings, metrics, widths, revision', async () => {
    const r = await build(format)
    const font = fontkit.create(Buffer.from(r.bytes)) as fontkit.Font
    expect(font.familyName).toBe('Format Test')
    expect(font.subfamilyName).toBe('Regular')
    expect(font.postscriptName).toBe('FormatTest-Regular')
    expect(font.version).toBe('Version 1.002')
    expect(font.copyright).toBe('Copyright 2026 Example Studio')
    expect(font.unitsPerEm).toBe(1000)
    const analysis = analyzeTypeface(face())
    expect(font.numGlyphs).toBe(analysis.supportedCount + 1)
    for (const g of analysis.supported) {
      const glyph = font.glyphForCodePoint(g.char.codePointAt(0)!)
      expect(glyph.id, g.char).toBeGreaterThan(0)
      expect(glyph.advanceWidth, g.char).toBe(g.advanceWidth)
    }
    for (const c of '&@{}~') expect(font.hasGlyphForCodePoint(c.codePointAt(0)!), c).toBe(true)
    expect(font['OS/2'].winAscent).toBe(font.ascent)
    expect(font['OS/2'].vendorID).toBe('NONE')
  })

  it('draws the same ink as the design (areas and bounds from the file’s own outlines)', async () => {
    const r = await build(format)
    const font = fontkit.create(Buffer.from(r.bytes)) as fontkit.Font
    for (const char of 'HOgS8') {
      const designed = analyzeTypeface(face()).reports.get(char)!.glyph!
      const bbox = font.glyphForCodePoint(char.codePointAt(0)!).bbox
      const xs = designed.contours.flat().map((p) => p.x)
      const ys = designed.contours.flat().map((p) => p.y)
      expect([bbox.minX, bbox.maxX, bbox.minY, bbox.maxY], char).toEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)])
    }
  })

  it('is deterministic for identical input', async () => {
    expect((await build(format)).bytes).toEqual((await build(format)).bytes)
  })

  it('exports an edited (frozen) outline exactly as edited', async () => {
    const base = face()
    const h = analyzeTypeface(base).reports.get('H')!.glyph!
    const edited = setGlyphOutline(base, 'H', h.contours.map((c) => c.map((p) => (p.x === Math.max(...h.contours.flat().map((q) => q.x)) ? { ...p, x: p.x + 20 } : p))), h.advanceWidth + 20)
    const r = await build(format, edited)
    const font = fontkit.create(Buffer.from(r.bytes)) as fontkit.Font
    expect(font.glyphForCodePoint(72).advanceWidth).toBe(h.advanceWidth + 20)
    expect((await verifyFontBytes(r.bytes, edited, format, '1.002')).issues).toEqual([])
  })
})

it('writes both files for manual inspection when WRITE_SPIKE_OUTPUT is set', async () => {
  if (!process.env['WRITE_SPIKE_OUTPUT']) return
  mkdirSync('spikes/output', { recursive: true })
  for (const f of FORMAT_IDS) {
    const r = await build(f)
    writeFileSync(`spikes/output/${r.filename}`, r.bytes)
  }
})

describe('otf specifics', () => {
  it('writes PostScript winding (outer contours counter-clockwise), the opposite of TrueType, with the same shapes', async () => {
    const otf = fontkit.create(Buffer.from((await build('otf')).bytes)) as fontkit.Font
    const ttf = fontkit.create(Buffer.from((await build('ttf')).bytes)) as fontkit.Font
    const area = (font: fontkit.Font, ch: string) => {
      const path = font.glyphForCodePoint(ch.codePointAt(0)!).path
      let total = 0
      let pts: Array<{ x: number; y: number }> = []
      for (const c of path.commands) {
        if (c.command === 'moveTo') pts = [{ x: c.args[0]!, y: c.args[1]! }]
        else if (c.command === 'lineTo') pts.push({ x: c.args[0]!, y: c.args[1]! })
        else if (c.command === 'closePath') {
          total += signedArea(pts.map((p) => ({ ...p, onCurve: true })))
          pts = []
        }
      }
      return total
    }
    expect(area(ttf, 'I')).toBeLessThan(0) // clockwise
    expect(area(otf, 'I')).toBeGreaterThan(0) // counter-clockwise
    expect(Math.abs(area(otf, 'H'))).toBeCloseTo(Math.abs(area(ttf, 'H')), 0)
  })
})

describe('guards against a wrong or damaged file', () => {
  it('refuses to call TrueType bytes an OpenType file, and the reverse', async () => {
    const ttf = (await build('ttf')).bytes
    const otf = (await build('otf')).bytes
    expect(() => assertBytesAre(ttf, 'otf')).toThrow(/content is ttf/)
    expect(() => assertBytesAre(otf, 'ttf')).toThrow(/content is otf/)
    expect(() => assertBytesAre(new Uint8Array([1, 2, 3, 4]), 'ttf')).toThrow(/unknown/)
  })

  it('read-back reports a signature that does not match the requested format', async () => {
    const ttf = (await build('ttf')).bytes
    const report = await verifyFontBytes(ttf, face(), 'otf', '1.002')
    expect(report.issues.map((i) => i.code)).toContain('binary.format-mismatch')
  })

  it('read-back catches a corrupted table (checksum) and a changed advance width', async () => {
    const good = (await build('ttf')).bytes
    const broken = new Uint8Array(good)
    const hmtx = readDirectory(broken)!.tables.find((t) => t.tag === 'hmtx')!
    broken[hmtx.offset + 5] = (broken[hmtx.offset + 5]! + 1) & 0xff // low byte of glyph 1's advance width
    const report = await verifyFontBytes(broken, face(), 'ttf', '1.002')
    const codes = report.issues.map((i) => i.code)
    expect(codes).toContain('binary.checksum')
    expect(codes.some((c) => c === 'binary.advance')).toBe(true)
  })

  it('read-back catches a font built from a different design (wrong mapping set)', async () => {
    const other = face()
    const { bytes } = await build('ttf', { ...other, overrides: { H: { advanceWidth: 900 } } })
    const report = await verifyFontBytes(bytes, other, 'ttf', '1.002')
    expect(report.issues.some((i) => i.code === 'binary.advance' && i.glyph === 'H')).toBe(true)
  })

  it('read-back catches left side bearings that do not match where the ink starts (the glyphs would render shifted)', async () => {
    const good = (await build('ttf')).bytes
    const broken = new Uint8Array(good)
    const dir = readDirectory(broken)!
    const hmtx = dir.tables.find((t) => t.tag === 'hmtx')!
    const numGlyphs = new DataView(broken.buffer).getUint16(dir.tables.find((t) => t.tag === 'maxp')!.offset + 4)
    for (let g = 0; g < numGlyphs; g++) {
      broken[hmtx.offset + g * 4 + 2] = 0
      broken[hmtx.offset + g * 4 + 3] = 0
    }
    const report = await verifyFontBytes(broken, face(), 'ttf', '1.002')
    const hits = report.issues.filter((i) => i.code === 'binary.side-bearing')
    expect(hits.length).toBeGreaterThan(50)
    expect(hits.find((i) => i.glyph === 'H')!.message).toContain('browsers would draw it')
  })

  it('read-back catches metadata that differs from the project', async () => {
    const { bytes } = await build('ttf')
    const changed = { ...face(), copyright: 'Copyright 1999 Somebody Else' }
    const report = await verifyFontBytes(bytes, changed, 'ttf', '1.002')
    expect(report.issues.map((i) => i.code)).toContain('binary.names')
  })
})

describe('exportTypeface', () => {
  const project = (): Project => ({ ...createProject('Export test'), customTypeface: face() })
  const ids = () => 'rec-1'
  const now = () => new Date(TIMESTAMP)

  it.each(FORMAT_IDS)('produces a verified %s with a history record of the right kind', async (format) => {
    const r = await exportTypeface(project(), ids, now, format)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.record.kind).toBe(FORMATS[format].kind)
    expect(r.record.filename.endsWith(FORMATS[format].extension)).toBe(true)
    expect(r.record.bytes).toBe(r.build.bytes.byteLength)
    expect(r.passed.length).toBeGreaterThan(3)
  })

  it('offers no file when the design has errors', async () => {
    const p = project()
    p.customTypeface = { ...face(), overrides: { H: { contours: [[{ x: 0, y: 0, onCurve: true }, { x: 100, y: 0, onCurve: true }, { x: 100, y: 700, onCurve: true }, { x: 0, y: 700, onCurve: true }]] } } }
    const r = await exportTypeface(p, ids, now, 'otf')
    expect(r).toMatchObject({ ok: false, stage: 'design' })
  })

  it('reports a failing build as a recoverable result, not an exception, and leaves the project alone', async () => {
    const p = project()
    const before = JSON.stringify(p)
    const spy = vi.spyOn(fontFluxBuilder, 'build').mockRejectedValueOnce(new Error('boom'))
    const r = await exportTypeface(p, ids, now, 'ttf')
    spy.mockRestore()
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.stage).toBe('build')
      expect(r.model.issues.some((i) => i.code === 'export.build-failed' && i.message.includes('boom'))).toBe(true)
    }
    expect(JSON.stringify(p)).toBe(before)
  })

  it('never reports success for a file that fails the read-back', async () => {
    const spy = vi.spyOn(fontFluxBuilder, 'build').mockImplementationOnce(async () => {
      const real = await build('ttf', { ...face(), overrides: { H: { advanceWidth: 900 } } })
      return real
    })
    const r = await exportTypeface(project(), ids, now, 'ttf')
    spy.mockRestore()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r).toMatchObject({ stage: 'file' })
  })
})
