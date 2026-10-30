/**
 * WOFF (1.0) to a plain sfnt. A WOFF file is an sfnt whose tables are each zlib-compressed; unwrapping it is a
 * header, a table directory and an inflate per table. The bundled catalog fonts ship as WOFF and WOFF2, and WOFF is
 * the one that can be turned back into a font file with nothing but the platform's own decompressor.
 */
const u16 = (v: DataView, o: number) => v.getUint16(o, false)
const u32 = (v: DataView, o: number) => v.getUint32(o, false)

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function woffToSfnt(woff: Uint8Array): Promise<Uint8Array> {
  const v = new DataView(woff.buffer, woff.byteOffset, woff.byteLength)
  if (woff.length < 44 || u32(v, 0) !== 0x774f4646) throw new Error('Not a WOFF file.')
  const flavor = u32(v, 4)
  const count = u16(v, 12)
  const tables: Array<{ tag: number; checksum: number; data: Uint8Array }> = []
  for (let i = 0; i < count; i++) {
    const e = 44 + i * 20
    const offset = u32(v, e + 4)
    const compLength = u32(v, e + 8)
    const origLength = u32(v, e + 12)
    if (offset + compLength > woff.length) throw new Error('The WOFF file is cut short.')
    const raw = woff.subarray(offset, offset + compLength)
    const data = compLength < origLength ? await inflate(raw) : raw
    if (data.length !== origLength) throw new Error('A WOFF table has the wrong length.')
    tables.push({ tag: u32(v, e), checksum: u32(v, e + 16), data })
  }
  tables.sort((a, b) => a.tag - b.tag)

  const dirSize = 12 + 16 * tables.length
  const total = tables.reduce((n, t) => n + ((t.data.length + 3) & ~3), dirSize)
  const out = new Uint8Array(total)
  const o = new DataView(out.buffer)
  let entrySelector = 0
  while (1 << (entrySelector + 1) <= tables.length) entrySelector++
  const searchRange = (1 << entrySelector) * 16
  o.setUint32(0, flavor)
  o.setUint16(4, tables.length)
  o.setUint16(6, searchRange)
  o.setUint16(8, entrySelector)
  o.setUint16(10, tables.length * 16 - searchRange)
  let at = dirSize
  tables.forEach((t, i) => {
    const e = 12 + i * 16
    o.setUint32(e, t.tag)
    o.setUint32(e + 4, t.checksum)
    o.setUint32(e + 8, at)
    o.setUint32(e + 12, t.data.length)
    out.set(t.data, at)
    at += (t.data.length + 3) & ~3
  })
  return out
}
