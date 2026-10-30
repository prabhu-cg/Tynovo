// Fails when the production build is heavier than the budgets below. Run after `npm run build` (npm run check does).
// Sizes are gzip level 9, what a visitor downloads from a host that compresses (Vercel does).
//
// The budgets are the measured size on 2026-10-27 plus about 15% headroom. Raising one is a decision: say why in the commit.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const KB = 1024
const BUDGETS = {
  /** Everything a first visit to any page downloads before it can run: the entry script and what it preloads. */
  firstLoadJs: 190 * KB,
  /** The stylesheet (Tailwind output for the whole site and app). */
  css: 17 * KB, // 16 until the workflow bar's motion and arrival styles (about 0.8 KB gzip) were added on 2026-10-31
  /** The one font file preloaded on every page (Manrope, Latin). */
  firstLoadFont: 30 * KB,
  /** Any lazily loaded route or feature chunk. */
  lazyChunk: 35 * KB,
  /** Chunks allowed to exceed lazyChunk, and by how much. They load only when the person asks for the feature. */
  exceptions: {
    'font-flux-js': 135 * KB, // the font writer, loaded on the first export only
    // The pure-JavaScript Brotli encoder and decoder (the `brotli` package), loaded only when a WOFF2 is built or read. Most of the
    // encoder is its 195 KB base64 memory image. A WebAssembly build would be smaller but needs 'wasm-unsafe-eval' in the CSP.
    compress: 260 * KB,
    decompress: 68 * KB,
  },
}
/** Never part of the first load: they must stay lazy. */
const MUST_BE_LAZY = ['font-flux-js', 'TypefacePage', 'ExportPage', 'TypographyPage', 'quality', 'compress', 'decompress', 'pdf']

const dist = new URL('../dist/', import.meta.url).pathname
if (!existsSync(join(dist, 'index.html'))) {
  console.error('budgets: dist/ is missing. Run `npm run build` first.')
  process.exit(2)
}
const gz = (file) => gzipSync(readFileSync(join(dist, file)), { level: 9 }).length
const kb = (n) => `${(n / KB).toFixed(1)} KB`
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const refs = (re) => [...html.matchAll(re)].map((m) => m[1].replace(/^\//, ''))

const firstJs = refs(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)
const firstCss = refs(/href="(\/assets\/[^"]+\.css)"/g)
const firstFonts = refs(/href="(\/assets\/[^"]+\.woff2)"/g)
const baseName = (f) => f.replace(/^assets\//, '').replace(/-[A-Za-z0-9_-]{8}\.js$/, '')

const rows = []
const check = (label, size, budget) => rows.push({ label, size, budget, ok: size <= budget })

check(`first-load JS (${firstJs.length} files)`, firstJs.reduce((a, f) => a + gz(f), 0), BUDGETS.firstLoadJs)
check('stylesheet', firstCss.reduce((a, f) => a + gz(f), 0), BUDGETS.css)
for (const f of firstFonts) check(`preloaded font ${f.replace('assets/', '').replace(/-[A-Za-z0-9_-]{8}\.woff2$/, '')}`, readFileSync(join(dist, f)).length, BUDGETS.firstLoadFont)

const firstNames = new Set(firstJs.map(baseName))
for (const name of MUST_BE_LAZY) {
  const loaded = firstNames.has(name)
  rows.push({ label: `${name} stays out of the first load`, size: loaded ? 1 : 0, budget: 0, ok: !loaded, text: loaded ? 'IN FIRST LOAD' : 'lazy' })
}

for (const f of readdirSync(join(dist, 'assets')).filter((n) => n.endsWith('.js'))) {
  const file = `assets/${f}`
  if (firstJs.includes(file)) continue
  const name = baseName(file)
  check(`chunk ${name}`, gz(file), BUDGETS.exceptions[name] ?? BUDGETS.lazyChunk)
}

const width = Math.max(...rows.map((r) => r.label.length))
const shown = new Set([...rows].sort((a, b) => b.size - a.size).slice(0, 14).concat(rows.filter((r) => !r.ok)))
for (const r of shown) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.label.padEnd(width)}  ${r.text ?? `${kb(r.size)} / ${kb(r.budget)}`}`)
const bad = rows.filter((r) => !r.ok)
if (bad.length) {
  console.error(`\nbudgets: ${bad.length} over budget. Reduce the build or raise the budget in scripts/check-budgets.mjs with a reason.`)
  process.exit(1)
}
console.log(`\nbudgets: all ${rows.length} within budget.`)
