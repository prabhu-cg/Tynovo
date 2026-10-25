/**
 * Minimal sfnt reader used to check exported files without trusting the library that wrote them:
 * table directory and checksums. Pure, no dependencies.
 */
export interface SfntTable {
  tag: string
  checksum: number
  offset: number
  length: number
}

export function readDirectory(bytes: Uint8Array): { tables: SfntTable[]; sfntVersion: number } | null {
  if (bytes.length < 12) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const count = view.getUint16(4)
  if (bytes.length < 12 + count * 16) return null
  const tables: SfntTable[] = []
  for (let i = 0; i < count; i++) {
    const rec = 12 + i * 16
    tables.push({
      tag: String.fromCharCode(bytes[rec]!, bytes[rec + 1]!, bytes[rec + 2]!, bytes[rec + 3]!),
      checksum: view.getUint32(rec + 4),
      offset: view.getUint32(rec + 8),
      length: view.getUint32(rec + 12),
    })
  }
  return { tables, sfntVersion: view.getUint32(0) }
}

/** Sum of big-endian uint32 words, zero-padded at the end, modulo 2^32. */
export function checksum(bytes: Uint8Array, offset: number, length: number): number {
  let sum = 0
  const end = offset + length
  for (let i = offset; i < end; i += 4) {
    sum = (sum + (bytes[i] ?? 0) * 0x1000000 + ((bytes[i + 1] ?? 0) << 16) + ((bytes[i + 2] ?? 0) << 8) + (bytes[i + 3] ?? 0)) % 0x100000000
  }
  return sum
}

export const CHECKSUM_MAGIC = 0xb1b0afba

export interface ChecksumProblem {
  table: string
  expected: number
  actual: number
}

/** Table checksums (head is checked with its adjustment field zeroed) and the whole-file rule. */
export function verifyChecksums(bytes: Uint8Array): { problems: ChecksumProblem[]; wholeFileOk: boolean } | null {
  const dir = readDirectory(bytes)
  if (!dir) return null
  const problems: ChecksumProblem[] = []
  for (const t of dir.tables) {
    if (t.offset + t.length > bytes.length) {
      problems.push({ table: t.tag, expected: t.checksum, actual: -1 })
      continue
    }
    let actual: number
    if (t.tag === 'head' && t.length >= 12) {
      const copy = bytes.slice(t.offset, t.offset + t.length)
      copy[8] = copy[9] = copy[10] = copy[11] = 0
      actual = checksum(copy, 0, copy.length)
    } else {
      actual = checksum(bytes, t.offset, t.length)
    }
    if (actual !== t.checksum) problems.push({ table: t.tag, expected: t.checksum, actual })
  }
  return { problems, wholeFileOk: checksum(bytes, 0, bytes.length) === CHECKSUM_MAGIC }
}
