/**
 * Helvetica and Helvetica-Bold, the two fonts every PDF viewer has. Used for labels and as the fallback for a font
 * Tynovo cannot embed. Widths are the standard Adobe metrics (1000 units per em) for printable ASCII; accented
 * letters take their base letter's width and a few common punctuation marks have their own.
 */
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]
const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]

/** Code points in the Windows-1252 block 0x80-0x9F that WinAnsiEncoding draws, with the byte for each. */
const WIN_ANSI_EXTRA = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
  [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
])
/** Widths of those marks, regular and bold. */
const EXTRA_WIDTH = new Map<number, [number, number]>([
  [0x2026, [1000, 1000]], [0x2018, [222, 278]], [0x2019, [222, 278]], [0x201c, [333, 500]], [0x201d, [333, 500]], [0x2022, [350, 350]], [0x2013, [556, 556]],
  [0x2014, [1000, 1000]], [0x20ac, [556, 556]], [0x2122, [1000, 1000]], [0x201a, [222, 278]], [0x201e, [333, 500]], [0x2039, [333, 333]], [0x203a, [333, 333]],
])

/** The WinAnsi byte for a code point, or null when Helvetica has no such character. */
export function winAnsiByte(cp: number): number | null {
  if (cp >= 0x20 && cp <= 0x7e) return cp
  if (cp >= 0xa0 && cp <= 0xff) return cp
  return WIN_ANSI_EXTRA.get(cp) ?? null
}

export interface StandardFont {
  kind: 'standard'
  /** PDF base font name. */
  name: 'Helvetica' | 'Helvetica-Bold'
  has: (cp: number) => boolean
  /** Width of the text in points at the given size. */
  width: (text: string, size: number) => number
}

const baseWidth = (cp: number, bold: boolean): number => {
  const table = bold ? BOLD : REGULAR
  if (cp >= 0x20 && cp <= 0x7e) return table[cp - 0x20]!
  const extra = EXTRA_WIDTH.get(cp)
  if (extra) return extra[bold ? 1 : 0]
  // Latin-1 letters with accents: the width of the letter underneath.
  const base = String.fromCodePoint(cp).normalize('NFD')[0]!.codePointAt(0)!
  if (base >= 0x20 && base <= 0x7e) return table[base - 0x20]!
  return cp === 0xa0 ? table[0]! : 556
}

export const helveticaFont = (bold: boolean): StandardFont => ({
  kind: 'standard',
  name: bold ? 'Helvetica-Bold' : 'Helvetica',
  has: (cp) => winAnsiByte(cp) !== null,
  width: (text, size) => ([...text].reduce((w, c) => w + baseWidth(c.codePointAt(0)!, bold), 0) * size) / 1000,
})
