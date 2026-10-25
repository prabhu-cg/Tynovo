import type { CustomTypeface } from '@/modules/brand-projects/schema'
import { generateTypeface } from '../typeface-engine/generate'
import { glyphToSvgPath } from './geometry'

export interface RunItem {
  char: string
  x: number
  d: string
}

export interface LayoutOptions {
  /** Extra space after every character, in font units (like CSS letter-spacing). */
  tracking?: number
  /** Extra space added to every space character, in font units (like CSS word-spacing). */
  wordSpacing?: number
  /** Wrap lines wider than this (font units). Omit for a single line per paragraph. */
  maxWidth?: number
}

export interface LayoutLine {
  items: RunItem[]
  width: number
}

export interface TextLayout {
  lines: LayoutLine[]
  /** Widest line. */
  width: number
  /** Characters in the text that the typeface has no glyph for (skipped, like a missing character). */
  missing: string[]
}

/**
 * Lay out text with the design’s advance widths and kerning pairs. This is the editor preview: it is drawn from
 * the glyph data, not by a text engine, so it shows what the outlines and kerning say rather than what a given
 * program will do with the exported file (see the rendering check in the preview).
 */
export function layoutText(face: CustomTypeface, text: string, opts: LayoutOptions = {}): TextLayout {
  const { tracking = 0, wordSpacing = 0, maxWidth = Infinity } = opts
  // Only the characters in the text are generated (and cached), so previews stay cheap while sliders move.
  const chars = [...new Set([...text].filter((c) => c !== '\n'))]
  const byChar = new Map(generateTypeface(face, chars).glyphs.map((g) => [g.char, g] as const))
  const kern = new Map(face.kerning.map((k) => [`${k.left}${k.right}`, k.value]))
  const missing = chars.filter((c) => !byChar.has(c))
  const paths = new Map<string, string>()
  const pathOf = (c: string) => paths.get(c) ?? (paths.set(c, glyphToSvgPath(byChar.get(c)!.contours)), paths.get(c)!)

  /** Place one word starting at x, after `prev`; also says where the visible ink of the word ends. */
  const place = (word: string, startX: number, startPrev: string | null) => {
    const items: RunItem[] = []
    let x = startX
    let prev = startPrev
    let right = startX
    for (const ch of [...word]) {
      const g = byChar.get(ch)
      if (!g) continue
      if (prev) x += kern.get(`${prev}${ch}`) ?? 0
      items.push({ char: ch, x, d: pathOf(ch) })
      right = ch === ' ' ? right : x + g.advanceWidth
      x += g.advanceWidth + tracking + (ch === ' ' ? wordSpacing : 0)
      prev = ch
    }
    return { items, x, prev, right }
  }

  const lines: LayoutLine[] = []
  for (const paragraph of text.split('\n')) {
    // Words keep their trailing spaces, so a break falls after a space and the space hangs at the line end.
    const words = paragraph.match(/[^ ]+ *| +/g) ?? ['']
    let items: RunItem[] = []
    let x = 0
    let prev: string | null = null
    for (const word of words) {
      let placed = place(word, x, prev)
      if (items.length > 0 && placed.right > maxWidth) {
        lines.push({ items, width: x })
        items = []
        placed = place(word, 0, null)
      }
      items.push(...placed.items)
      x = placed.x
      prev = placed.prev
    }
    lines.push({ items, width: x })
  }
  return { lines, width: Math.max(0, ...lines.map((l) => l.width)), missing }
}

/** Single-line layout used by the specimens that scale to their container. */
export function layoutRun(face: CustomTypeface, text: string): { items: RunItem[]; width: number } {
  const { lines, width } = layoutText(face, text.replace(/\n/g, ' '))
  return { items: lines[0]?.items ?? [], width }
}
