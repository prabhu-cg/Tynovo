import type { CustomTypeface } from '@/modules/brand-projects/schema'
import { layoutText } from '../glyph-editor/layout'
import { generateTypeface } from '../typeface-engine/generate'

/**
 * Compares the editor preview (outlines drawn from the glyph data) with what the browser draws from the exported
 * font file. Two measurements, both about the same text at the same size:
 *  - width: the preview’s total advance, in font units, against the font’s advance as measured by the browser
 *  - agreement: the share of inked pixels on which the two renderings agree, within one pixel (see `inkAgreement`)
 * Browser-only (needs canvas). The comparison itself, `inkAgreement`, is pure and tested.
 */
export interface RenderingComparison {
  /** What was compared (the first line, only characters the typeface has). */
  text: string
  previewWidth: number
  fontWidth: number
  /** 0–1, or null if the canvas could not be read. */
  overlap: number | null
  sizePx: number
}

/**
 * How well two renderings agree, 0–1. Each is reduced to inked pixels (alpha above `threshold`); an inked pixel
 * counts as agreeing when the other rendering has ink within `tolerance` pixels of it. Anti-aliasing and glyph
 * positions snapped to whole pixels move edges by under a pixel and so do not count; a shifted, missing or
 * different shape does. Blank against blank is 1.
 */
export function inkAgreement(a: Uint8ClampedArray | Uint8Array, b: Uint8ClampedArray | Uint8Array, width: number, height: number, tolerance = 1, threshold = 127): number {
  const ink = (src: Uint8ClampedArray | Uint8Array) => {
    const m = new Uint8Array(width * height)
    for (let i = 0; i < m.length; i++) m[i] = src[i * 4 + 3]! > threshold ? 1 : 0
    return m
  }
  const near = (m: Uint8Array) => {
    // Dilate by `tolerance` in both directions (separable max filter).
    const h = new Uint8Array(m.length)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let v = 0
      for (let k = -tolerance; k <= tolerance && !v; k++) { const xx = x + k; if (xx >= 0 && xx < width && m[y * width + xx]) v = 1 }
      h[y * width + x] = v
    }
    const out = new Uint8Array(m.length)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let v = 0
      for (let k = -tolerance; k <= tolerance && !v; k++) { const yy = y + k; if (yy >= 0 && yy < height && h[yy * width + x]) v = 1 }
      out[y * width + x] = v
    }
    return out
  }
  const ma = ink(a)
  const mb = ink(b)
  const da = near(ma)
  const db = near(mb)
  let union = 0
  let off = 0
  for (let i = 0; i < ma.length; i++) {
    if (ma[i] || mb[i]) union += 1
    if (ma[i] && !db[i]) off += 1
    if (mb[i] && !da[i]) off += 1
  }
  return union === 0 ? 1 : Math.max(0, 1 - off / union)
}

const PX = 160
const MAX_CHARS = 40

export async function compareRendering(face: CustomTypeface, text: string, family: string): Promise<RenderingComparison> {
  const have = new Set(generateTypeface(face, [...new Set([...text])]).glyphs.map((g) => g.char))
  const line = [...(text.split('\n')[0] ?? '')].filter((c) => have.has(c)).slice(0, MAX_CHARS).join('')
  if (!line) throw new Error('The first line has no characters that the typeface contains, so there is nothing to compare.')
  await document.fonts.load(`${PX}px "${family}"`, line)

  const layout = layoutText(face, line)
  const scale = PX / 1000
  const pad = 24
  const width = Math.ceil(layout.width * scale + pad * 2)
  const height = Math.ceil(PX * 1.7)
  const baseline = Math.round(PX * 1.15)
  const make = () => {
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    return c
  }

  const preview = make()
  const pctx = preview.getContext('2d', { willReadFrequently: true })!
  pctx.fillStyle = '#000'
  for (const item of layout.lines[0]?.items ?? []) {
    pctx.save()
    pctx.translate(pad + item.x * scale, baseline)
    pctx.scale(scale, -scale)
    pctx.fill(new Path2D(item.d), 'nonzero')
    pctx.restore()
  }

  const exported = make()
  const ectx = exported.getContext('2d', { willReadFrequently: true })!
  ectx.fillStyle = '#000'
  ectx.font = `${PX}px "${family}"`
  ectx.textBaseline = 'alphabetic'
  ectx.fillText(line, pad, baseline)
  const fontWidth = ectx.measureText(line).width / scale

  let overlap: number | null = null
  try {
    overlap = inkAgreement(pctx.getImageData(0, 0, width, height).data, ectx.getImageData(0, 0, width, height).data, width, height)
  } catch {
    overlap = null
  }
  return { text: line, previewWidth: layout.width, fontWidth, overlap, sizePx: PX }
}
