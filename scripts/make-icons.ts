// One-off generator for the favicon set. Run: npx tsx scripts/make-icons.ts
// Draws the supplied logo mark (src/modules/identity/identity.ts holds its outline) and writes:
//   public/favicon.svg          the mark itself; its grey lightens on dark browser tabs
//   public/favicon-32.png       fallback for browsers without SVG favicons
//   public/apple-touch-icon.png 180px, on white (iOS draws no transparency)
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { MARK_COLORS, MARK_PATHS, MARK_VIEWBOX } from '../src/modules/identity/identity'

const paths = (fill: (k: 'ink' | 'accent') => string) => MARK_PATHS.map((p) => `<path d="${p.d}" fill="${fill(p.fill)}"/>`).join('')
const { width: W, height: H } = MARK_VIEWBOX

// A tab icon is drawn small and on a browser's own background, which may be dark: the grey needs to lighten there.
const favicon = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" xmlns="http://www.w3.org/2000/svg">
<style>.i{fill:${MARK_COLORS.ink}}.a{fill:${MARK_COLORS.accent}}@media (prefers-color-scheme:dark){.i{fill:#ececea}}</style>
${MARK_PATHS.map((p) => `<path class="${p.fill === 'ink' ? 'i' : 'a'}" d="${p.d}"/>`).join('\n')}
</svg>
`
const dir = new URL('../public/', import.meta.url)
mkdirSync(dir, { recursive: true })
writeFileSync(new URL('favicon.svg', dir), favicon)

const tile = (size: number, pad: number, bg: string) => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}body{width:${size}px;height:${size}px;background:${bg};display:grid;place-items:center}</style>
<svg width="${size - 2 * pad}" height="${size - 2 * pad}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" fill="none">${paths((k) => MARK_COLORS[k])}</svg>`

const browser = await chromium.launch()
for (const [file, size, pad, bg] of [['favicon-32.png', 32, 2, 'transparent'], ['apple-touch-icon.png', 180, 34, '#ffffff']] as const) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(tile(size, pad, bg))
  await page.screenshot({ path: new URL(file, dir).pathname, omitBackground: bg === 'transparent' })
  await page.close()
}
await browser.close()
console.log('Wrote favicon.svg, favicon-32.png, apple-touch-icon.png')
