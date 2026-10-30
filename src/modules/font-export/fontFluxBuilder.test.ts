// @vitest-environment node
import { mkdirSync, writeFileSync } from 'node:fs'
import * as fontkit from 'fontkit'
import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { createTypeface } from '@/modules/typeface-engine/typeface'
import { validateFontBinary, validateTypeface } from '@/modules/font-validation/validate'
import { fontFluxBuilder } from './fontFluxBuilder'
import { patchOs2 } from './sfntPatch'

const TIMESTAMP = '2026-03-04T05:06:07.000Z'

/** Read head.created straight from the sfnt table directory (seconds since 1904-01-01 UTC) as epoch ms. */
function readHeadCreated(bytes: Uint8Array): number {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const numTables = v.getUint16(4)
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16
    const tag = String.fromCharCode(...bytes.slice(rec, rec + 4))
    if (tag === 'head') {
      const offset = v.getUint32(rec + 8)
      const seconds = Number(v.getBigInt64(offset + 20))
      return (seconds - 2082844800) * 1000
    }
  }
  throw new Error('no head table')
}

async function build() {
  const typeface = { ...createTypeface('face-1', 'geometric', 'Test Display'), kerning: [{ left: 'A', right: 'T', value: -60 }] }
  typeface.copyright = 'Copyright 2026 Example Studio'
  typeface.license = { name: 'SIL Open Font License 1.1', spdx: 'OFL-1.1', url: 'https://openfontlicense.org', verified: true }
  const result = await fontFluxBuilder.build({ typeface, timestamp: TIMESTAMP, version: '1.002' })
  return { typeface, result }
}

describe('Font Flux TrueType export (generated typeface)', () => {
  it('produces a real sfnt binary, not an image', async () => {
    const { result } = await build()
    expect(result.filename).toBe('TestDisplay-Regular.ttf')
    const magic = new DataView(result.bytes.buffer, result.bytes.byteOffset).getUint32(0)
    expect(magic).toBe(0x00010000) // TrueType sfnt version
    expect(result.bytes.byteLength).toBeGreaterThan(10_000)
  })

  it('has no model or binary validation errors', async () => {
    const { typeface, result } = await build()
    expect(validateTypeface(typeface).issues.filter((i) => i.severity === 'error')).toEqual([])
    expect((await validateFontBinary(result.bytes)).errorCount).toBe(0)
  })

  it('is readable by an independent parser (fontkit): names, cmap, metrics, kerning', async () => {
    const { typeface, result } = await build()
    const font = fontkit.create(Buffer.from(result.bytes)) as fontkit.Font
    expect(font.familyName).toBe('Test Display')
    expect(font.subfamilyName).toBe('Regular')
    expect(font.postscriptName).toBe('TestDisplay-Regular')
    expect(font.unitsPerEm).toBe(1000)
    expect(font.ascent).toBe(742)
    expect(font.descent).toBe(-212)
    // The font contains exactly the glyphs that passed validation: every one present, every missing one absent.
    const analysis = analyzeTypeface(typeface)
    for (const g of analysis.supported) expect(font.hasGlyphForCodePoint(g.char.codePointAt(0)!), g.char).toBe(true)
    for (const c of '&@{}~') expect(font.hasGlyphForCodePoint(c.codePointAt(0)!), c).toBe(true)
    // Advance widths in the file equal the generator's.
    for (const g of analysis.supported) expect(font.glyphForCodePoint(g.char.codePointAt(0)!).advanceWidth, g.char).toBe(g.advanceWidth)

    const I = font.glyphForCodePoint('I'.codePointAt(0)!)
    expect(I.bbox).toMatchObject({ minX: 60, minY: 0, maxX: 150, maxY: 700 })

    const noKern = font.layout('AT', [], undefined, undefined, undefined).positions.map((p) => p.xAdvance)
    const A = font.glyphForCodePoint(65).advanceWidth
    expect(noKern[0]).toBe(A - 60) // kern A,T = -60 applied through GPOS
  })

  it('round-trips metadata through Font Flux itself', async () => {
    const { result } = await build()
    const { FontFlux } = await import('font-flux-js')
    const f = FontFlux.open(result.bytes)
    expect(f.info.familyName).toBe('Test Display')
    expect(f.glyphCount).toBe(95 + 1) // every supported glyph + .notdef
    expect(f.getKerning('A', 'T')).toBe(-60)
  })

  it('writes the supplied copyright, version, licence and creation date into the file', async () => {
    const { result } = await build()
    const font = fontkit.create(Buffer.from(result.bytes)) as fontkit.Font
    expect(font.copyright).toBe('Copyright 2026 Example Studio')
    expect(font.version).toMatch(/1\.002/)
    expect((font as unknown as { name: { records: Record<string, Record<string, string> | undefined> } }).name.records['license']?.['en'] ?? '').toContain('SIL Open Font License')
    expect(new Date(readHeadCreated(result.bytes)).toISOString()).toBe(TIMESTAMP)
  })

  it('is deterministic for identical input', async () => {
    expect((await build()).result.bytes).toEqual((await build()).result.bytes)
  })

  it('writes the file for manual inspection when WRITE_SPIKE_OUTPUT is set', async () => {
    if (!process.env['WRITE_SPIKE_OUTPUT']) return
    mkdirSync('spikes/output', { recursive: true })
    writeFileSync('spikes/output/TestDisplay-Regular.ttf', (await build()).result.bytes)
  })
})

describe('OS/2 patching', () => {
  it('sets win metrics, x-height and vendor id, and keeps sfnt checksums valid', async () => {
    const { result } = await build()
    const font = fontkit.create(Buffer.from(result.bytes)) as fontkit.Font
    const os2 = font['OS/2']
    expect(os2.winAscent).toBe(742)
    expect(os2.winDescent).toBe(212)
    expect(os2.xHeight).toBe(504)
    expect(os2.vendorID).toBe('NONE')
    // Whole-file checksum rule: sum of all uint32 words == 0xB1B0AFBA.
    let sum = 0
    const padded = new Uint8Array(Math.ceil(result.bytes.length / 4) * 4)
    padded.set(result.bytes)
    const dv = new DataView(padded.buffer)
    for (let i = 0; i < padded.length; i += 4) sum = (sum + dv.getUint32(i)) % 0x100000000
    expect(sum).toBe(0xb1b0afba)
  })
  it('rejects a bad vendor id and does not mutate its input', async () => {
    const { result } = await build()
    const copy = new Uint8Array(result.bytes)
    expect(() => patchOs2(result.bytes, { winAscent: 1, winDescent: 1, xHeight: 1, vendorId: 'toolong' })).toThrow()
    patchOs2(result.bytes, { winAscent: 1, winDescent: 1, xHeight: 1, vendorId: 'ABCD' })
    expect(result.bytes).toEqual(copy)
  })
})
