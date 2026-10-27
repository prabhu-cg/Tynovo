// Writes dist/third-party-notices.txt: the licence text of every package that ships to visitors (production dependencies,
// including the bundled fonts). Identical licence texts are written once with the packages that share them.
// Runs from postbuild. Reads package-lock.json and node_modules only; nothing is fetched.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../', import.meta.url).pathname
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))

const LICENCE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt))?$/i
const normalise = (text) => text.replace(/\r\n/g, '\n').trim()

/** @type {Map<string, { text: string, spdx: Set<string>, packages: string[] }>} */
const groups = new Map()
const withoutText = []

const packages = Object.entries(lock.packages)
  .filter(([path, meta]) => path.startsWith('node_modules/') && !meta.dev && !meta.devOptional)
  .map(([path, meta]) => ({ path, meta, name: path.replace(/^.*node_modules\//, '') }))
  .sort((a, b) => a.name.localeCompare(b.name))

for (const { path, meta, name } of packages) {
  const dir = join(root, path)
  const pkg = existsSync(join(dir, 'package.json')) ? JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) : {}
  const spdx = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? meta.license ?? 'unknown')
  const label = `${name}@${pkg.version ?? meta.version}`
  const file = existsSync(dir) ? readdirSync(dir).find((f) => LICENCE_FILE.test(f)) : undefined
  if (!file) {
    withoutText.push(`${label} (${spdx})`)
    continue
  }
  const text = normalise(readFileSync(join(dir, file), 'utf8'))
  const g = groups.get(text) ?? { text, spdx: new Set(), packages: [] }
  g.spdx.add(spdx)
  g.packages.push(label)
  groups.set(text, g)
}

const rule = '='.repeat(78)
const out = [
  'Tynovo - third-party notices',
  '',
  'Tynovo itself is released under the GNU General Public License v3.0 only (see LICENSE in the source repository).',
  'This file reproduces the licence text of the packages Tynovo ships to your browser: the code it runs on and the',
  'fonts it bundles. It is generated at build time from the installed packages.',
  '',
  `Packages: ${packages.length}. Distinct licence texts: ${groups.size}.`,
  '',
]
for (const g of [...groups.values()].sort((a, b) => b.packages.length - a.packages.length)) {
  out.push(rule, `Licence: ${[...g.spdx].sort().join(', ')}`, `Applies to (${g.packages.length}): ${g.packages.join(', ')}`, rule, '', g.text, '')
}
if (withoutText.length) {
  out.push(rule, 'Packages that carry a licence identifier but no licence file', rule, '', ...withoutText.map((l) => `- ${l}`), '')
}

const dist = join(root, 'dist')
if (!existsSync(dist)) throw new Error('third-party-notices: dist/ is missing; run vite build first.')
writeFileSync(join(dist, 'third-party-notices.txt'), out.join('\n'))
console.log(`third-party-notices: ${packages.length} packages, ${groups.size} distinct licence texts, ${withoutText.length} without a licence file.`)
