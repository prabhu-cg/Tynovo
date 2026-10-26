// One-off generator for public/og.png (1200x630). Run: npx tsx scripts/make-og.ts
// Draws outlines produced by the real typeface generator, so the image is not a mock-up.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { glyphToSvgPath } from '../src/modules/glyph-editor/geometry'
import { MARK_COLORS, MARK_PATHS, MARK_VIEWBOX, PRODUCT_NAME, TAGLINE } from '../src/modules/identity/identity'
import { deriveMetrics } from '../src/modules/typeface-engine/dna'
import { generateTypeface } from '../src/modules/typeface-engine/generate'
import { createTypeface } from '../src/modules/typeface-engine/typeface'

const face = createTypeface('og', 'geometric')
const m = deriveMetrics(face.dna)
const glyphs = new Map(generateTypeface(face, [...'HOTEL']).glyphs.map((g) => [g.char, g]))
let x = 0
const paths = [...'HOTEL'].map((ch) => {
  const g = glyphs.get(ch)!
  const out = `<path d="${glyphToSvgPath(g.contours)}" transform="translate(${x} 0)"/>`
  x += g.advanceWidth
  return out
})
const scale = 1056 / x // fit the word to the artwork width
const woff2 = readFileSync(new URL('../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2', import.meta.url))
const fontFile = `data:font/woff2;base64,${woff2.toString('base64')}`
const height = (m.ascender - m.descender) * scale
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:M;src:url('${fontFile}') format('woff2');font-weight:200 800}
html,body{margin:0}body{width:1200px;height:630px;background:#f6f6f5;font-family:M;color:#444;position:relative;overflow:hidden}
.lockup{position:absolute;left:72px;top:52px;display:flex;align-items:center;gap:18px}.lockup .name{font-weight:800;font-size:44px;letter-spacing:-0.03em;color:#262626;line-height:1}.lockup .tag{font-weight:500;font-size:20px;color:#6b6b6b;margin-top:7px;line-height:1}
h1{position:absolute;left:72px;top:156px;margin:0;font-size:54px;line-height:1.05;letter-spacing:-0.02em;color:#262626;font-weight:800;width:900px}
svg.art{position:absolute;left:72px;top:330px}
.rule{position:absolute;left:72px;right:72px;top:${330 + m.ascender * scale}px;height:3px;background:#C74504}
</style>
<div class="lockup"><svg height="72" width="${Math.round((72 * MARK_VIEWBOX.width) / MARK_VIEWBOX.height)}" viewBox="0 0 ${MARK_VIEWBOX.width} ${MARK_VIEWBOX.height}" fill="none">${MARK_PATHS.map((p) => `<path d="${p.d}" fill="${MARK_COLORS[p.fill]}"/>`).join('')}</svg><div><div class="name">${PRODUCT_NAME}</div><div class="tag">${TAGLINE}</div></div></div>
<h1>Build your brand typography. Create your own typeface.</h1>
<svg class="art" width="1056" height="${height}" viewBox="0 ${-m.ascender} ${x} ${m.ascender - m.descender}">
<g transform="scale(1 -1)" fill="#262626">${paths.join('')}</g></svg><div class="rule"></div>`

mkdirSync(new URL('../public/', import.meta.url), { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
await page.evaluate(() => document.fonts.ready)
const png = await page.screenshot({ type: 'png' })
writeFileSync(new URL('../public/og.png', import.meta.url), png)
await browser.close()
console.log('wrote public/og.png', png.length, 'bytes')
