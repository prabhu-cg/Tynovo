/**
 * Page metadata for every public route. Pure data and functions with no imports, so the
 * post-build script (Node) and the client (Seo component) share exactly one source of truth.
 */
export const SITE_NAME = 'Brand Typography Studio'

export interface PageMeta {
  path: string
  /** Page-specific part of the title; the site name is appended. Empty for the home page. */
  title: string
  description: string
  /** false keeps the page out of the sitemap and tells crawlers not to index it. */
  indexable: boolean
}

export const HOME_TITLE = `${SITE_NAME}: build your brand typography, create your own typeface`

export const PUBLIC_PAGES: readonly PageMeta[] = [
  {
    path: '/',
    title: '',
    description:
      'A free, browser-based studio for brand typography systems and original display typefaces. No account. Projects stay on your device.',
    indexable: true,
  },
  {
    path: '/features',
    title: 'Features',
    description:
      'What Brand Typography Studio does today and what is still in development: type scales, local projects, a procedural typeface generator with three families, and real font export.',
    indexable: true,
  },
  {
    path: '/how-it-works',
    title: 'How it works',
    description: 'From a new project to a typography system and a font file: the workflow, step by step, with what is available now marked clearly.',
    indexable: true,
  },
  {
    path: '/pricing',
    title: 'Pricing',
    description: 'The studio is free to use today, with no account. Paid options are undecided; no plans, prices or dates exist yet.',
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
    description: 'How licensing works: the app, the fonts you choose, and the fonts you generate are licensed separately.',
    indexable: true,
  },
  {
    path: '/faq',
    title: 'FAQ',
    description: 'Common questions and honest limitations: storage, privacy, font export, licensing and what is not built yet.',
    indexable: true,
  },
  {
    path: '/privacy',
    title: 'Privacy (draft)',
    description: 'Draft privacy notice. It describes how the app behaves today and must be reviewed before public launch.',
    indexable: false,
  },
  {
    path: '/terms',
    title: 'Terms (draft)',
    description: 'Draft terms of use. They must be reviewed before public launch.',
    indexable: false,
  },
]

export const APP_DESCRIPTION = 'Brand Typography Studio application.'

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
