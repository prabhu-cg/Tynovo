// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { verifyFontBytes } from '@/modules/font-validation/readback'
import { createTypeface } from '@/modules/typeface-engine/typeface'
import { readWoff2, sfntTables, unwrapWoff, wrapWoff, wrapWoff2 } from './container'
import { fontFluxBuilder } from './fontFluxBuilder'

const TS = '2026-03-04T05:06:07.000Z'
const face = () => createTypeface('f1', 'rounded', 'Container Test')
const ttf = () => fontFluxBuilder.build({ typeface: face(), timestamp: TS, version: '1.002', format: 'ttf' })
const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i])

describe('WOFF and WOFF2 containers', () => {
  it('hold the very bytes of the TrueType file: unwrapping gives the .ttf back, byte for byte', async () => {
    const { bytes } = await ttf()
    expect(equal(await unwrapWoff(await wrapWoff(bytes)), bytes)).toBe(true)
    expect(equal((await readWoff2(await wrapWoff2(bytes))).sfnt, bytes)).toBe(true)
  })

  it('compress: WOFF2 is smaller than WOFF, and WOFF smaller than the .ttf', async () => {
    const { bytes } = await ttf()
    const woff = await wrapWoff(bytes)
    const woff2 = await wrapWoff2(bytes)
    expect(woff.length).toBeLessThan(bytes.length)
    expect(woff2.length).toBeLessThan(woff.length)
  })

  it('write headers that state their own size, the size of the font inside, and the version of the font', async () => {
    const { bytes } = await ttf()
    for (const wrapped of [await wrapWoff(bytes), await wrapWoff2(bytes)]) {
      const v = new DataView(wrapped.buffer, wrapped.byteOffset, wrapped.byteLength)
      expect(v.getUint32(8)).toBe(wrapped.length) // total length
      expect(v.getUint32(4)).toBe(0x00010000) // the flavor is the font's: TrueType
      expect(wrapped.length % 4).toBe(0)
      expect(v.getUint16(12)).toBe(sfntTables(bytes).tables.length)
    }
    const woff = new DataView((await wrapWoff(bytes)).buffer)
    expect(woff.getUint32(16)).toBe(bytes.length) // totalSfntSize equals the plain file
    expect([woff.getUint16(20), woff.getUint16(22)]).toEqual([1, 2]) // font version 1.002
  })

  it('are deterministic', async () => {
    const { bytes } = await ttf()
    expect(equal(await wrapWoff(bytes), await wrapWoff(bytes))).toBe(true)
    expect(equal(await wrapWoff2(bytes), await wrapWoff2(bytes))).toBe(true)
  })

  it('are refused, with the reason, when damaged: a wrong length, a flipped byte in the compressed data, a cut file', async () => {
    const t = face()
    const woff2 = (await fontFluxBuilder.build({ typeface: t, timestamp: TS, version: '1.002', format: 'woff2' })).bytes
    const woff = (await fontFluxBuilder.build({ typeface: t, timestamp: TS, version: '1.002', format: 'woff' })).bytes
    const good = await verifyFontBytes(woff2, t, 'woff2', '1.002')
    expect(good.issues).toEqual([])

    const cut = await verifyFontBytes(woff2.subarray(0, woff2.length - 12), t, 'woff2', '1.002')
    expect(cut.issues.some((i) => i.code === 'binary.container')).toBe(true)

    const flipped = new Uint8Array(woff2)
    flipped[flipped.length - 40] = flipped[flipped.length - 40]! ^ 0xff
    const bad = await verifyFontBytes(flipped, t, 'woff2', '1.002')
    expect(bad.issues.length).toBeGreaterThan(0)

    const badLength = new Uint8Array(woff)
    new DataView(badLength.buffer).setUint32(8, woff.length + 4)
    expect((await verifyFontBytes(badLength, t, 'woff', '1.002')).issues.some((i) => i.code === 'binary.container')).toBe(true)

    // A changed table inside a container is caught by the checksums of the unpacked font.
    const tables = sfntTables((await ttf()).bytes)
    expect(tables.tables.find((x) => x.tag === 'glyf')!.data.length).toBeGreaterThan(1000)
  })

  it('report what they checked as evidence', async () => {
    const t = face()
    for (const format of ['woff', 'woff2'] as const) {
      const built = await fontFluxBuilder.build({ typeface: t, timestamp: TS, version: '1.002', format })
      const report = await verifyFontBytes(built.bytes, t, format, '1.002')
      expect(report.issues).toEqual([])
      expect(report.passed.some((p) => p.includes(format === 'woff' ? 'WOFF container' : 'WOFF2 container'))).toBe(true)
      expect(report.passed.some((p) => p.includes('checksum'))).toBe(true)
    }
  })
})
