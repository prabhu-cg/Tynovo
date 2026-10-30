/**
 * Page metadata for every public route. Pure data and functions (its only import is the plain-strings identity module), so the
 * post-build script (Node) and the client (Seo component) share exactly one source of truth.
 */
import { PRODUCT_NAME, TAGLINE } from '../identity/identity.ts'
import { CATALOG_SIZE } from './content.ts'

export const SITE_NAME = PRODUCT_NAME
export { TAGLINE }

export interface PageMeta {
  path: string
  /** Page-specific part of the title; the site name is appended. Empty for the home page. */
  title: string
  description: string
  /** false keeps the page out of the sitemap and tells crawlers not to index it. */
  indexable: boolean
}

export const HOME_TITLE = `${SITE_NAME}: ${TAGLINE.charAt(0).toLowerCase()}${TAGLINE.slice(1)} with brand typography and your own typeface`

export const PUBLIC_PAGES: readonly PageMeta[] = [
  {
    path: '/',
    title: '',
    description:
      'Tynovo helps you shape your brand’s voice: build a brand typography system from licensed fonts, or generate an original typeface and export real font files. Free, in your browser, no account.',
    indexable: true,
  },
  {
    path: '/features',
    title: 'Features',
    description:
      `What Tynovo does today and what is not built yet: brand direction, a ${CATALOG_SIZE}-font licensed catalog, roles, a fluid type scale, previews, a typeface generator with glyph editing, and real exports.`,
    indexable: true,
  },
  {
    path: '/how-it-works',
    title: 'How it works',
    description: 'From a new project to a typography system and font files: brand direction, fonts, roles, scale, your own typeface, previews, checks and exports, with what is available now marked clearly.',
    indexable: true,
  },
  {
    path: '/pricing',
    title: 'Pricing',
    description: 'Tynovo is free today, with no account and no payment system. Paid options are undecided: no plans, prices or dates exist, and exporting your own projects is built never to be restricted.',
    indexable: true,
  },
  {
    path: '/examples',
    title: 'Examples',
    description: 'Typography specimens and illustrative brand type systems built from licensed open fonts. Illustrative only: no customers are shown.',
    indexable: true,
  },
  {
    path: '/licensing',
    title: 'Licensing',
    description: `How licensing works: the software, the ${CATALOG_SIZE} bundled fonts, the fonts you choose and the fonts you generate are licensed separately, with the licence and copyright of each bundled font.`,
    indexable: true,
  },
  {
    path: '/faq',
    title: 'FAQ',
    description: 'Common questions and honest limitations: storage, privacy, fonts and licences, exports, plans and what is not built yet.',
    indexable: true,
  },
  {
    path: '/privacy',
    title: 'Privacy',
    description: 'How Tynovo handles data: projects stay in your browser, with no accounts, analytics or cookies; what the hosting provider records; and your rights.',
    indexable: true,
  },
  {
    path: '/terms',
    title: 'Terms of use',
    description: 'The rules for using Tynovo in plain language: what you keep, what you are responsible for, fonts and licences, and what is not promised.',
    indexable: true,
  },
]

export const APP_DESCRIPTION = `${PRODUCT_NAME}: ${TAGLINE}.`

export function pageTitle(title: string): string {
  return title ? `${title} · ${SITE_NAME}` : HOME_TITLE
}

/** Normalise a configured base URL: trim, drop trailing slashes. Returns '' when unset or invalid. */
export function normalizeSiteUrl(raw: string | undefined | null): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '')
  if (!/^https?:\/\/[^\s/]+/i.test(value)) return ''
  return value
}

export function canonicalUrl(siteUrl: string, path: string): string {
  if (!siteUrl) return ''
  return path === '/' ? `${siteUrl}/` : `${siteUrl}${path}`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export interface MetaOptions {
  siteUrl: string
  /** Path of the OG image relative to the site root. */
  ogImagePath?: string
  ogImageAlt?: string
}

/** The head tags for a page, as a list of descriptors (used by both HTML generation and the client). */
export type HeadTag =
  | { tag: 'meta'; attr: 'name' | 'property'; key: string; content: string }
  | { tag: 'link'; rel: string; href: string }

export function headTags(page: Pick<PageMeta, 'path' | 'description' | 'indexable'> & { title: string }, opts: MetaOptions): HeadTag[] {
  const fullTitle = page.title
  const canonical = canonicalUrl(opts.siteUrl, page.path)
  const tags: HeadTag[] = [
    { tag: 'meta', attr: 'name', key: 'description', content: page.description },
    { tag: 'meta', attr: 'name', key: 'robots', content: page.indexable ? 'index,follow' : 'noindex,nofollow' },
    { tag: 'meta', attr: 'property', key: 'og:type', content: 'website' },
    { tag: 'meta', attr: 'property', key: 'og:site_name', content: SITE_NAME },
    { tag: 'meta', attr: 'property', key: 'og:title', content: fullTitle },
    { tag: 'meta', attr: 'property', key: 'og:description', content: page.description },
    { tag: 'meta', attr: 'name', key: 'twitter:card', content: 'summary_large_image' },
    { tag: 'meta', attr: 'name', key: 'twitter:title', content: fullTitle },
    { tag: 'meta', attr: 'name', key: 'twitter:description', content: page.description },
  ]
  if (canonical && page.indexable) {
    tags.push({ tag: 'link', rel: 'canonical', href: canonical })
    tags.push({ tag: 'meta', attr: 'property', key: 'og:url', content: canonical })
  }
  if (opts.siteUrl && opts.ogImagePath) {
    const image = `${opts.siteUrl}${opts.ogImagePath}`
    tags.push({ tag: 'meta', attr: 'property', key: 'og:image', content: image })
    tags.push({ tag: 'meta', attr: 'name', key: 'twitter:image', content: image })
    if (opts.ogImageAlt) {
      tags.push({ tag: 'meta', attr: 'property', key: 'og:image:alt', content: opts.ogImageAlt })
      tags.push({ tag: 'meta', attr: 'name', key: 'twitter:image:alt', content: opts.ogImageAlt })
    }
  }
  return tags
}

export const SEO_START = '<!--seo:start-->'
export const SEO_END = '<!--seo:end-->'

/** Replace the marked head block of an index.html template with tags for one page. Pure. */
export function applyMeta(template: string, page: PageMeta, opts: MetaOptions): string {
  const title = pageTitle(page.title)
  const html = headTags({ ...page, title }, opts)
    .map((t) =>
      t.tag === 'meta'
        ? `<meta ${t.attr}="${t.key}" content="${esc(t.content)}" />`
        : `<link rel="${t.rel}" href="${esc(t.href)}" />`,
    )
    .join('\n    ')
  const block = `${SEO_START}\n    <title>${esc(title)}</title>\n    ${html}\n    ${SEO_END}`
  const start = template.indexOf(SEO_START)
  const end = template.indexOf(SEO_END)
  if (start === -1 || end === -1 || end < start) throw new Error('index.html is missing the seo:start / seo:end markers')
  return template.slice(0, start) + block + template.slice(end + SEO_END.length)
}

export function buildSitemap(siteUrl: string, pages: readonly PageMeta[] = PUBLIC_PAGES): string {
  const urls = pages
    .filter((p) => p.indexable)
    .map((p) => `  <url><loc>${esc(canonicalUrl(siteUrl, p.path))}</loc></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export function buildRobots(siteUrl: string): string {
  const lines = ['User-agent: *', 'Allow: /', 'Disallow: /app/', '']
  if (siteUrl) lines.push(`Sitemap: ${siteUrl}/sitemap.xml`, '')
  return lines.join('\n')
}
