/**
 * Minimal, checksum-correct patching of fixed-offset OS/2 fields in an exported sfnt.
 * Font Flux derives these fields from glyph bounds at export time and does not let callers set them;
 * tight usWin* metrics give legacy Windows apps cramped line spacing.
 */
export interface Os2Patch {
  winAscent: number
  winDescent: number
  xHeight: number
  /** Exactly four printable ASCII characters. */
  vendorId: string
}

// Offsets inside the OS/2 table (version >= 2).
const OFFSET_VENDOR_ID = 58
const OFFSET_WIN_ASCENT = 74
const OFFSET_WIN_DESCENT = 76
const OFFSET_X_HEIGHT = 86
const OS2_MIN_LENGTH = 96

function tableChecksum(bytes: Uint8Array, offset: number, length: number): number {
  let sum = 0
  const end = offset + length
  for (let i = offset; i < end; i += 4) {
    const word =
      ((bytes[i] ?? 0) * 0x1000000) + ((bytes[i + 1] ?? 0) << 16) + ((bytes[i + 2] ?? 0) << 8) + (bytes[i + 3] ?? 0)
    sum = (sum + word) % 0x100000000
  }
  return sum
}

export function patchOs2(input: Uint8Array, patch: Os2Patch): Uint8Array {
  if (!/^[\x20-\x7e]{4}$/.test(patch.vendorId)) throw new Error('vendorId must be 4 printable ASCII characters')
  const bytes = new Uint8Array(input) // copy: never mutate the caller's buffer
  const view = new DataView(bytes.buffer)
  const numTables = view.getUint16(4)

  let os2: { rec: number; offset: number; length: number } | null = null
  let head: { rec: number; offset: number } | null = null
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16
    const tag = String.fromCharCode(bytes[rec]!, bytes[rec + 1]!, bytes[rec + 2]!, bytes[rec + 3]!)
    if (tag === 'OS/2') os2 = { rec, offset: view.getUint32(rec + 8), length: view.getUint32(rec + 12) }
    if (tag === 'head') head = { rec, offset: view.getUint32(rec + 8) }
  }
  if (!os2 || !head) throw new Error('Font has no OS/2 or head table')
  if (os2.length < OS2_MIN_LENGTH) throw new Error('OS/2 table is too old/short to patch (need version 2+)')

  const o = os2.offset
  for (let i = 0; i < 4; i++) bytes[o + OFFSET_VENDOR_ID + i] = patch.vendorId.charCodeAt(i)
  view.setUint16(o + OFFSET_WIN_ASCENT, patch.winAscent)
  view.setUint16(o + OFFSET_WIN_DESCENT, patch.winDescent)
  view.setInt16(o + OFFSET_X_HEIGHT, patch.xHeight)

  view.setUint32(os2.rec + 4, tableChecksum(bytes, o, os2.length))
  // Directory checksum of `head` is taken with checkSumAdjustment zeroed (spec convention),
  // and must be final before the whole-file sum that determines the adjustment.
  view.setUint32(head.offset + 8, 0)
  view.setUint32(head.rec + 4, tableChecksum(bytes, head.offset, view.getUint32(head.rec + 12)))
  const total = tableChecksum(bytes, 0, bytes.length)
  view.setUint32(head.offset + 8, (0xb1b0afba - total + 0x100000000) % 0x100000000)
  return bytes
}
