/**
 * The little of a TrueType file a PDF needs: how wide each glyph is, which glyph draws a character, and the numbers
 * for the font descriptor. Reads only; nothing is rewritten, so the embedded font is the file as it was.
 */
export interface TrueTypeFont {
  unitsPerEm: number
  numGlyphs: number
  ascent: number
  descent: number
  capHeight: number
  /** xMin, yMin, xMax, yMax in font units. */
  bbox: [number, number, number, number]
  italicAngle: number
  /** Glyph index for a code point, 0 (.notdef) when the font has none. */
  glyphFor: (codePoint: number) => number
  /** Advance width of a glyph in font units. */
  advance: (glyph: number) => number
}

export function parseTrueType(bytes: Uint8Array): TrueTypeFont {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = v.getUint32(0)
  if (tag !== 0x00010000 && tag !== 0x74727565) throw new Error('Only TrueType outlines can be embedded.')
  const count = v.getUint16(4)
  const tables = new Map<string, { offset: number; length: number }>()
  for (let i = 0; i < count; i++) {
    const e = 12 + i * 16
    const name = String.fromCharCode(bytes[e]!, bytes[e + 1]!, bytes[e + 2]!, bytes[e + 3]!)
    const offset = v.getUint32(e + 8)
    const length = v.getUint32(e + 12)
    if (offset + length > bytes.length) throw new Error(`The ${name} table runs past the end of the file.`)
    tables.set(name, { offset, length })
  }
  const need = (name: string) => {
    const t = tables.get(name)
    if (!t) throw new Error(`The font has no ${name} table.`)
    return t.offset
  }
  const head = need('head')
  const unitsPerEm = v.getUint16(head + 18)
  if (unitsPerEm < 16) throw new Error('The font has an invalid units-per-em.')
  const bbox: [number, number, number, number] = [v.getInt16(head + 36), v.getInt16(head + 38), v.getInt16(head + 40), v.getInt16(head + 42)]
  const hhea = need('hhea')
  const numGlyphs = v.getUint16(need('maxp') + 4)
  const hmtx = need('hmtx')
  const hmtxLen = tables.get('hmtx')!.length
  const metrics = Math.min(v.getUint16(hhea + 34), Math.floor(hmtxLen / 4))
  const advance = (g: number): number => (metrics === 0 ? 0 : v.getUint16(hmtx + Math.min(g, metrics - 1) * 4))

  const os2 = tables.get('OS/2')
  const capHeight = os2 && os2.length >= 90 && v.getUint16(os2.offset) >= 2 ? v.getInt16(os2.offset + 88) : Math.round(v.getInt16(hhea + 4) * 0.7)
  const post = tables.get('post')
  const italicAngle = post ? v.getInt32(post.offset + 4) / 65536 : 0

  // The best Unicode subtable: full range (3,10) or (0,4+), else the basic plane (3,1) or (0,*).
  const cmap = need('cmap')
  const n = v.getUint16(cmap + 2)
  let best: { offset: number; rank: number } | null = null
  for (let i = 0; i < n; i++) {
    const platform = v.getUint16(cmap + 4 + i * 8)
    const encoding = v.getUint16(cmap + 6 + i * 8)
    const offset = cmap + v.getUint32(cmap + 8 + i * 8)
    const format = v.getUint16(offset)
    if (format !== 4 && format !== 12) continue
    const rank = platform === 3 && encoding === 10 ? 4 : platform === 0 && format === 12 ? 4 : platform === 3 && encoding === 1 ? 3 : platform === 0 ? 2 : 0
    if (rank > 0 && (!best || rank > best.rank)) best = { offset, rank }
  }
  if (!best) throw new Error('The font has no Unicode character map.')
  const sub = best.offset
  const format = v.getUint16(sub)

  const lookup4 = (cp: number): number => {
    if (cp > 0xffff) return 0
    const segX2 = v.getUint16(sub + 6)
    const ends = sub + 14
    const starts = ends + segX2 + 2
    const deltas = starts + segX2
    const ranges = deltas + segX2
    for (let s = 0; s < segX2; s += 2) {
      if (cp > v.getUint16(ends + s)) continue
      const start = v.getUint16(starts + s)
      if (cp < start) return 0
      const delta = v.getInt16(deltas + s)
      const range = v.getUint16(ranges + s)
      if (range === 0) return (cp + delta) & 0xffff
      const at = ranges + s + range + (cp - start) * 2
      if (at + 2 > bytes.length) return 0
      const g = v.getUint16(at)
      return g === 0 ? 0 : (g + delta) & 0xffff
    }
    return 0
  }
  const lookup12 = (cp: number): number => {
    const groups = v.getUint32(sub + 12)
    let lo = 0
    let hi = groups - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const g = sub + 16 + mid * 12
      const start = v.getUint32(g)
      const end = v.getUint32(g + 4)
      if (cp < start) hi = mid - 1
      else if (cp > end) lo = mid + 1
      else return v.getUint32(g + 8) + (cp - start)
    }
    return 0
  }
  const raw = format === 4 ? lookup4 : lookup12
  const glyphFor = (cp: number): number => {
    const g = raw(cp)
    return g < numGlyphs ? g : 0
  }
  return { unitsPerEm, numGlyphs, ascent: v.getInt16(hhea + 4), descent: v.getInt16(hhea + 6), capHeight, bbox, italicAngle, glyphFor, advance }
}
