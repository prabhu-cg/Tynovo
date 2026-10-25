import type { CustomTypeface } from '@/modules/brand-projects/schema'
import { generateTypeface } from '../typeface-engine/generate'
import { glyphToSvgPath } from './geometry'

export interface RunItem {
  char: string
  x: number
  d: string
}

/** Lay out text with advance widths and the typeface's kerning pairs. Characters with no glyph are skipped. */
export function layoutRun(face: CustomTypeface, text: string): { items: RunItem[]; width: number } {
  // Only the characters in the text are generated (and cached), so previews stay cheap while sliders move.
  const byChar = new Map(generateTypeface(face, [...new Set([...text])]).glyphs.map((g) => [g.char, g] as const))
  const kern = new Map(face.kerning.map((k) => [`${k.left}${k.right}`, k.value]))
  const items: RunItem[] = []
  let x = 0
  let prev: string | null = null
  for (const ch of [...text]) {
    const g = byChar.get(ch)
    if (!g) continue
    if (prev) x += kern.get(`${prev}${ch}`) ?? 0
    items.push({ char: ch, x, d: glyphToSvgPath(g.contours) })
    x += g.advanceWidth
    prev = ch
  }
  return { items, width: x }
}
