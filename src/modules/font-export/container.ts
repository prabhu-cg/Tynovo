/**
 * WOFF and WOFF2 containers around a finished sfnt (our validated TrueType file), written and read here.
 *
 * Why not Font Flux's own WOFF export: it rebuilds the font from its model and drops the OS/2 metrics patch
 * (sfntPatch.ts), so the web file would differ from the .ttf it is supposed to be a copy of. A container only
 * compresses the tables; wrapping the very bytes the .ttf checks passed keeps every table identical, and the
 * read-back proves it (the tables come out of the container byte for byte, and the whole-file checksum holds).
 *
 * WOFF 1.0: each table is zlib-compressed on its own (the platform's CompressionStream).
 * WOFF2: the tables are concatenated, in tag order and with no transform applied (transform version 3 for glyf and
 * loca, 0 for the rest: "null transform"), and brotli-compressed as one block. Skipping the glyph transform costs a
 * little size and removes the whole class of bugs a transform can have. Brotli is the pure-JavaScript `brotli` package,
 * loaded only when a WOFF2 is built or read; a WebAssembly build would need 'wasm-unsafe-eval' in the page's content
 * security policy, and nothing here is worth weakening it.
 */
import { woffToSfnt } from '../export-centre/pdf-kit/woff'

const enc = new TextEncoder()
const tagOf = (b: Uint8Array, at: number) => String.fromCharCode(b[at]!, b[at + 1]!, b[at + 2]!, b[at + 3]!)
const pad4 = (n: number) => (n + 3) & ~3

interface SfntTable {
  tag: string
  /** Checksum as recorded in the sfnt directory. */
  checksum: number
  data: Uint8Array
}

/** The tables of a plain sfnt, in tag order. */
export function sfntTables(sfnt: Uint8Array): { flavor: number; tables: SfntTable[] } {
  const v = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength)
  const count = v.getUint16(4)
  const tables: SfntTable[] = []
  for (let i = 0; i < count; i++) {
    const e = 12 + i * 16
    const offset = v.getUint32(e + 8)
    const length = v.getUint32(e + 12)
    if (offset + length > sfnt.length) throw new Error('A table runs past the end of the font.')
    tables.push({ tag: tagOf(sfnt, e), checksum: v.getUint32(e + 4), data: sfnt.subarray(offset, offset + length) })
  }
  return { flavor: v.getUint32(0), tables: tables.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0)) }
}

/** The font's version as "major.minor" from head.fontRevision, for the container header. */
function revisionOf(tables: SfntTable[]): { major: number; minor: number } {
  const head = tables.find((t) => t.tag === 'head')
  if (!head) return { major: 1, minor: 0 }
  const rev = new DataView(head.data.buffer, head.data.byteOffset, head.data.byteLength).getUint32(4) / 65536
  return { major: Math.floor(rev), minor: Math.round((rev - Math.floor(rev)) * 1000) }
}

/** The size the font would have as a plain sfnt: header, directory and every table padded to four bytes. */
const sfntSize = (tables: SfntTable[]) => tables.reduce((n, t) => n + pad4(t.data.length), 12 + 16 * tables.length)

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/* ---------------------------------- WOFF 1.0 ---------------------------------- */

export async function wrapWoff(sfnt: Uint8Array): Promise<Uint8Array> {
  const { flavor, tables } = sfntTables(sfnt)
  const { major, minor } = revisionOf(tables)
  // A table is stored compressed only when that is smaller.
  const stored = await Promise.all(
    tables.map(async (t) => {
      const packed = await deflate(t.data)
      return { ...t, stored: packed.length < t.data.length ? packed : t.data }
    }),
  )
  const dirEnd = 44 + 20 * tables.length
  let offset = dirEnd
  const offsets = stored.map((t) => {
    const at = offset
    offset += pad4(t.stored.length)
    return at
  })
  const out = new Uint8Array(offset)
  const o = new DataView(out.buffer)
  o.setUint32(0, 0x774f4646) // wOFF
  o.setUint32(4, flavor)
  o.setUint32(8, out.length)
  o.setUint16(12, tables.length)
  o.setUint32(16, sfntSize(tables))
  o.setUint16(20, major)
  o.setUint16(22, minor)
  stored.forEach((t, i) => {
    const e = 44 + i * 20
    out.set(enc.encode(t.tag), e)
    o.setUint32(e + 4, offsets[i]!)
    o.setUint32(e + 8, t.stored.length)
    o.setUint32(e + 12, t.data.length)
    o.setUint32(e + 16, t.checksum)
    out.set(t.stored, offsets[i]!)
  })
  return out
}

/** A WOFF back to the sfnt it holds. */
export const unwrapWoff = woffToSfnt

/**
 * The plain sfnt inside any font file: the file itself for TTF and OTF, the unpacked tables for WOFF and WOFF2.
 * Everything that reads font content (validators, read-back) goes through this, so none of them needs WebAssembly,
 * which the page's content security policy does not allow.
 */
export async function innerSfnt(bytes: Uint8Array): Promise<Uint8Array> {
  const tag = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0)
  if (tag === 'wOFF') return unwrapWoff(bytes)
  if (tag === 'wOF2') return (await readWoff2(bytes)).sfnt
  return bytes
}

/* ---------------------------------- WOFF2 ---------------------------------- */

/** Tags that have a one-byte code in the WOFF2 directory, by code. */
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH',
  'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc',
  'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
]

/** UIntBase128: seven bits a byte, most significant first, the high bit set on every byte but the last. */
function base128(n: number): number[] {
  const bytes = [n & 0x7f]
  for (let rest = Math.floor(n / 128); rest > 0; rest = Math.floor(rest / 128)) bytes.unshift((rest & 0x7f) | 0x80)
  return bytes
}

/** Brotli in the font mode (2), at the best quality: a font is binary data with the structure of tables. */
async function brotliCompress(data: Uint8Array): Promise<Uint8Array> {
  const { default: compress } = await import('brotli/compress')
  const out = compress(data, { mode: 2, quality: 11, lgwin: 22 })
  if (!out) throw new Error('Brotli could not compress the font.')
  return out
}

async function brotliDecompress(data: Uint8Array): Promise<Uint8Array> {
  const { default: decompress } = await import('brotli/decompress')
  return new Uint8Array(decompress(data))
}

export async function wrapWoff2(sfnt: Uint8Array): Promise<Uint8Array> {
  const { flavor, tables } = sfntTables(sfnt)
  const { major, minor } = revisionOf(tables)
  const dir: number[] = []
  for (const t of tables) {
    const known = KNOWN_TAGS.indexOf(t.tag)
    // glyf and loca say "no transform" with version 3; every other table's version 0 already means that.
    const transform = t.tag === 'glyf' || t.tag === 'loca' ? 3 : 0
    dir.push((transform << 6) | (known >= 0 ? known : 63))
    if (known < 0) dir.push(...enc.encode(t.tag))
    dir.push(...base128(t.data.length))
  }
  const packed = await brotliCompress(concat(tables.map((t) => t.data)))
  const headerAndDirectory = 48 + dir.length
  const length = pad4(headerAndDirectory + packed.length)
  const out = new Uint8Array(length)
  const o = new DataView(out.buffer)
  o.setUint32(0, 0x774f4632) // wOF2
  o.setUint32(4, flavor)
  o.setUint32(8, length)
  o.setUint16(12, tables.length)
  o.setUint32(16, sfntSize(tables))
  o.setUint32(20, packed.length)
  o.setUint16(24, major)
  o.setUint16(26, minor)
  out.set(dir, 48)
  out.set(packed, headerAndDirectory)
  return out
}

/** What a WOFF2 holds: its header numbers, its directory, and the sfnt it would unpack to. */
export interface Woff2Contents {
  flavor: number
  length: number
  totalSfntSize: number
  totalCompressedSize: number
  tags: string[]
  /** Reconstructed as a plain sfnt, with correct table checksums. Only containers without transforms can be read here. */
  sfnt: Uint8Array
}

/** Read a WOFF2 written with no transform back into a plain sfnt, or throw. */
export async function readWoff2(bytes: Uint8Array): Promise<Woff2Contents> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length < 48 || v.getUint32(0) !== 0x774f4632) throw new Error('Not a WOFF2 file.')
  const count = v.getUint16(12)
  let at = 48
  const entries: Array<{ tag: string; length: number }> = []
  for (let i = 0; i < count; i++) {
    const flags = bytes[at++]!
    const known = flags & 0x3f
    const transform = flags >> 6
    let tag: string
    if (known === 63) {
      tag = tagOf(bytes, at)
      at += 4
    } else tag = KNOWN_TAGS[known] ?? ''
    let n = 0
    for (let k = 0; k < 5; k++) {
      const b = bytes[at++]!
      n = n * 128 + (b & 0x7f)
      if (!(b & 0x80)) break
    }
    const transformed = tag === 'glyf' || tag === 'loca' ? transform !== 3 : transform !== 0
    if (transformed) throw new Error(`The ${tag} table is transformed; only the untransformed form is read here.`)
    entries.push({ tag, length: n })
  }
  const compressedSize = v.getUint32(20)
  const raw = await brotliDecompress(bytes.subarray(at, at + compressedSize))
  const total = entries.reduce((n, e) => n + e.length, 0)
  if (raw.length !== total) throw new Error('The decompressed tables are not the size the directory says.')

  // Rebuild the sfnt: tables in directory (tag) order, each padded, with the directory's checksums recomputed.
  const dirSize = 12 + 16 * count
  const out = new Uint8Array(dirSize + entries.reduce((n, e) => n + pad4(e.length), 0))
  const o = new DataView(out.buffer)
  let entrySelector = 0
  while (1 << (entrySelector + 1) <= count) entrySelector++
  const searchRange = (1 << entrySelector) * 16
  o.setUint32(0, v.getUint32(4))
  o.setUint16(4, count)
  o.setUint16(6, searchRange)
  o.setUint16(8, entrySelector)
  o.setUint16(10, count * 16 - searchRange)
  let src = 0
  let dst = dirSize
  entries.forEach((e, i) => {
    const data = raw.subarray(src, src + e.length)
    src += e.length
    out.set(data, dst)
    const rec = 12 + i * 16
    out.set(enc.encode(e.tag), rec)
    o.setUint32(rec + 4, checksum(out, dst, e.length, e.tag === 'head'))
    o.setUint32(rec + 8, dst)
    o.setUint32(rec + 12, e.length)
    dst += pad4(e.length)
  })
  return { flavor: v.getUint32(4), length: v.getUint32(8), totalSfntSize: v.getUint32(16), totalCompressedSize: compressedSize, tags: entries.map((e) => e.tag), sfnt: out }
}

/** A table's checksum; `head` is summed with its checkSumAdjustment taken as zero, as the format says. */
function checksum(bytes: Uint8Array, offset: number, length: number, isHead: boolean): number {
  let sum = 0
  const end = offset + pad4(length)
  for (let i = offset; i < end; i += 4) {
    if (isHead && i === offset + 8) continue
    sum = (sum + ((bytes[i] ?? 0) * 0x1000000 + ((bytes[i + 1] ?? 0) << 16) + ((bytes[i + 2] ?? 0) << 8) + (bytes[i + 3] ?? 0))) % 0x100000000
  }
  return sum
}
