// Checks the production build in dist/ the way a reviewer would, before it is deployed:
//   1. every public page has its own pre-rendered HTML, with one title and no inline script or style;
//   2. every file those pages reference exists, and nothing references another origin except the public URL;
//   3. the files a launch needs are there (404.html, robots.txt, sitemap.xml, icons, social image, notices);
//   4. no secret reached the output: not the value of any secret-looking environment variable, not a known credential shape;
//   5. no source maps are published.
// Exit code 1 on any failure. Run after `npm run build` (npm run check does).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { loadEnv } from 'vite'
import { normalizeSiteUrl, PUBLIC_PAGES } from '../src/modules/marketing/seo-config.ts'

const root = new URL('../', import.meta.url).pathname
const dist = join(root, 'dist')
if (!existsSync(join(dist, 'index.html'))) {
  console.error('verify-dist: dist/ is missing. Run `npm run build` first.')
  process.exit(2)
}

const failures = []
const fail = (msg) => failures.push(msg)
const read = (p) => readFileSync(join(dist, p), 'utf8')
const siteUrl = normalizeSiteUrl(process.env.VITE_SITE_URL ?? loadEnv('production', root, 'VITE_').VITE_SITE_URL)

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
const files = walk(dist)

// 1 + 2. pages
for (const page of PUBLIC_PAGES) {
  const file = page.path === '/' ? 'index.html' : join(page.path.slice(1), 'index.html')
  if (!existsSync(join(dist, file))) {
    fail(`${page.path}: ${file} was not pre-rendered`)
    continue
  }
  const html = read(file)
  const titles = html.match(/<title>/g)?.length ?? 0
  if (titles !== 1) fail(`${page.path}: ${titles} <title> elements`)
  if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html)) fail(`${page.path}: inline <script> (the content security policy forbids it)`)
  if (/<style\b/.test(html)) fail(`${page.path}: inline <style> (the content security policy forbids it)`)
  if (/\son[a-z]+\s*=/.test(html)) fail(`${page.path}: inline event handler attribute`)
  for (const [, attr, url] of html.matchAll(/\b(src|href)="([^"]+)"/g)) {
    if (url.startsWith('#') || url.startsWith('data:')) continue
    if (/^https?:\/\//.test(url)) {
      if (!siteUrl || !url.startsWith(siteUrl)) fail(`${page.path}: ${attr}="${url}" points to another origin`)
      continue
    }
    const local = url.split(/[?#]/)[0]
    if (local === '/' || PUBLIC_PAGES.some((p) => p.path === local)) continue
    if (!existsSync(join(dist, local.replace(/^\//, '')))) fail(`${page.path}: ${attr}="${url}" does not exist in dist/`)
  }
  if (siteUrl) {
    const want = page.path === '/' ? `${siteUrl}/` : `${siteUrl}${page.path}`
    if (page.indexable && !html.includes(`<link rel="canonical" href="${want}"`)) fail(`${page.path}: canonical link is not ${want}`)
  }
}

// 3. launch files
for (const f of ['404.html', 'robots.txt', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'og.png', 'third-party-notices.txt']) {
  if (!existsSync(join(dist, f))) fail(`missing ${f}`)
}
if (existsSync(join(dist, '404.html')) && !read('404.html').includes('noindex')) fail('404.html is not marked noindex')
if (siteUrl) {
  if (!existsSync(join(dist, 'sitemap.xml'))) fail('VITE_SITE_URL is set but sitemap.xml was not written')
  else {
    const map = read('sitemap.xml')
    for (const p of PUBLIC_PAGES.filter((x) => x.indexable)) if (!map.includes(`<loc>${siteUrl}${p.path === '/' ? '/' : p.path}</loc>`)) fail(`sitemap.xml lacks ${p.path}`)
    for (const p of PUBLIC_PAGES.filter((x) => !x.indexable)) if (map.includes(`${siteUrl}${p.path}<`)) fail(`sitemap.xml lists ${p.path}, which is not indexable`)
  }
  if (!read('robots.txt').includes(`Sitemap: ${siteUrl}/sitemap.xml`)) fail('robots.txt does not point at the sitemap')
} else {
  console.warn('verify-dist: VITE_SITE_URL is not set, so canonical links and the sitemap were not checked. Set it for a production build.')
}

// 4. secrets
const textFiles = files.filter((f) => /\.(js|css|html|txt|json|xml|svg|webmanifest)$/.test(f))
const SECRETISH = /(TOKEN|SECRET|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_?KEY|OIDC|AUTH)/i
const envValues = new Map()
const addEnv = (k, v) => v && v.length >= 8 && SECRETISH.test(k) && !envValues.has(v) && envValues.set(v, k)
for (const [k, v] of Object.entries(process.env)) addEnv(k, v)
for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  const p = join(root, name)
  if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) addEnv(m[1], m[2].replace(/^["']|["']$/g, ''))
  }
}
const SHAPES = [
  ['a JSON web token', /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ['a private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['an AWS access key id', /\bAKIA[0-9A-Z]{16}\b/],
  ['a GitHub token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b/],
  ['a Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['a Stripe secret key', /\b[sr]k_(live|test)_[A-Za-z0-9]{16,}/],
  ['a Vercel token', /\bvc[pk]_[A-Za-z0-9]{20,}/],
]
for (const f of textFiles) {
  const text = readFileSync(f, 'utf8')
  const where = relative(dist, f)
  for (const [value, name] of envValues) if (text.includes(value)) fail(`${where} contains the value of environment variable ${name}`)
  for (const [label, re] of SHAPES) if (re.test(text)) fail(`${where} contains what looks like ${label}`)
}

// 5. source maps
for (const f of files.filter((x) => x.endsWith('.map'))) fail(`source map published: ${relative(dist, f)}`)
for (const f of files.filter((x) => /\.(js|css)$/.test(x))) if (/\/\/# sourceMappingURL=/.test(readFileSync(f, 'utf8'))) fail(`${relative(dist, f)} refers to a source map`)

if (failures.length) {
  console.error(`verify-dist: ${failures.length} problem${failures.length === 1 ? '' : 's'}:`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`verify-dist: ${PUBLIC_PAGES.length} pages, ${files.length} files, ${textFiles.length} scanned for ${envValues.size} secret value(s) and ${SHAPES.length} credential shapes. No problems.`)
