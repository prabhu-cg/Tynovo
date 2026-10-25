// Developer tool: render every generated glyph for each family to a PNG so geometry can be reviewed by eye.
// Run: npx tsx scripts/contact-sheet.ts [outDir]   (writes spikes/output/contact-<name>.png)
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { defaultDna, deriveMetrics } from '../src/modules/typeface-engine/dna'
import { GROUPS } from '../src/modules/typeface-engine/charset'
import { generateTypeface } from '../src/modules/typeface-engine/generate'
import { glyphToSvgPath } from '../src/modules/glyph-editor/geometry'
import type { Dna } from '../src/modules/brand-projects/schema'

const out = process.argv[2] ?? 'spikes/output'
// Optional: FOCUS='26^?' renders only those characters, large.
const focus = process.env.FOCUS ? [...process.env.FOCUS] : null
const scale = focus ? 2.2 : 6
mkdirSync(out, { recursive: true })

const only = process.env.ONLY
const variants: Record<string, Dna> = {
  geometric: defaultDna('geometric'),
  rounded: defaultDna('rounded'),
  modular: defaultDna('modular'),
  'geometric-heavy-contrast': { ...defaultDna('geometric'), strokeThickness: 150, contrast: 0.6, widthScale: 1.2 },
  'rounded-light': { ...defaultDna('rounded'), strokeThickness: 50, widthScale: 0.8, terminal: 'angled' },
  'geometric-round-terminals': { ...defaultDna('geometric'), terminal: 'round' },
  'geometric-angled-terminals': { ...defaultDna('geometric'), terminal: 'angled' },
}

function sheet(name: string, dna: Dna): string {
  const m = deriveMetrics(dna)
  const gen = generateTypeface({ dna, overrides: {} })
  const byChar = new Map(gen.glyphs.map((g) => [g.char, g]))
  const cell = 1000
  const rows: string[] = []
  for (const grp of GROUPS) {
    const chars = [...grp.chars].filter((c) => c !== ' ' && (!focus || focus.includes(c)))
    if (chars.length === 0) continue
    const cells = chars
      .map((c) => {
        const g = byChar.get(c)
        if (!g) return `<div class="cell miss"><i>${c === '<' ? '&lt;' : c === '&' ? '&amp;' : c}</i><small>missing</small></div>`
        const vb = `${-60} ${-(m.ascender + 60)} ${g.advanceWidth + 120} ${m.ascender - m.descender + 120}`
        return `<div class="cell"><svg viewBox="${vb}" width="${Math.round((g.advanceWidth + 120) / scale)}" height="${Math.round((m.ascender - m.descender + 120) / scale)}"><g transform="scale(1 -1)"><line x1="-60" x2="${g.advanceWidth + 60}" y1="0" y2="0" stroke="#C74504" stroke-width="3"/><line x1="-60" x2="${g.advanceWidth + 60}" y1="${m.xHeight}" y2="${m.xHeight}" stroke="#bbb" stroke-width="2"/><line x1="-60" x2="${g.advanceWidth + 60}" y1="${m.capHeight}" y2="${m.capHeight}" stroke="#bbb" stroke-width="2"/><rect x="0" y="-${60}" width="${g.advanceWidth}" height="${m.ascender - m.descender}" fill="none" stroke="#9cf" stroke-width="2" transform="translate(0 ${m.descender + 60})"/><path d="${glyphToSvgPath(g.contours)}" fill="#262626"/></g></svg></div>`
      })
      .join('')
    rows.push(`<h3>${grp.label}</h3><div class="row">${cells}</div>`)
  }
  void cell
  const sample = [...'HAMBURGEFONSTIV 0123'].map((c) => byChar.get(c)).filter(Boolean)
  void sample
  return `<h2>${name}</h2><p>${gen.glyphs.length} glyphs generated, ${gen.missing.length} missing</p>${rows.join('')}`
}

const html = `<!doctype html><meta charset=utf-8><style>body{font:14px sans-serif;margin:16px;background:#fff;width:1500px}h2{margin:24px 0 0}h3{margin:12px 0 4px;font-size:13px;color:#666}.row{display:flex;flex-wrap:wrap;gap:6px}.cell{border:1px solid #eee;padding:2px}.miss{width:48px;height:60px;display:grid;place-items:center;background:#fdf0f0;color:#b33;font-size:18px}.miss small{font-size:9px}</style>`

const browser = await chromium.launch()
for (const [name, dna] of Object.entries(variants)) {
  if (only && name !== only) continue
  const page = await browser.newPage({ viewport: { width: 1530, height: 900 } })
  await page.setContent(html + sheet(name, dna))
  const file = `${out}/contact-${name}.png`
  await page.screenshot({ path: file, fullPage: true })
  console.log('wrote', file)
  await page.close()
}
await browser.close()
writeFileSync(`${out}/.keep`, '')
