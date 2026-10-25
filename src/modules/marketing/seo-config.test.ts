import { applyMeta, buildRobots, buildSitemap, canonicalUrl, headTags, normalizeSiteUrl, pageTitle, PUBLIC_PAGES, SEO_END, SEO_START } from './seo-config'

const template = `<head>\n    ${SEO_START}\n    <title>x</title>\n    ${SEO_END}\n  </head>`
const home = PUBLIC_PAGES[0]!
const faq = PUBLIC_PAGES.find((p) => p.path === '/faq')!
const privacy = PUBLIC_PAGES.find((p) => p.path === '/privacy')!

describe('seo-config', () => {
  it('has unique titles and descriptions within sensible length', () => {
    expect(new Set(PUBLIC_PAGES.map((p) => p.path)).size).toBe(PUBLIC_PAGES.length)
    expect(new Set(PUBLIC_PAGES.map((p) => p.title)).size).toBe(PUBLIC_PAGES.length)
    expect(new Set(PUBLIC_PAGES.map((p) => p.description)).size).toBe(PUBLIC_PAGES.length)
    for (const p of PUBLIC_PAGES) {
      expect(p.description.length, p.path).toBeGreaterThan(50)
      expect(p.description.length, p.path).toBeLessThanOrEqual(200)
    }
  })

  it('normalises the configured base URL', () => {
    expect(normalizeSiteUrl('https://a.test/')).toBe('https://a.test')
    expect(normalizeSiteUrl(' https://a.test/base// ')).toBe('https://a.test/base')
    expect(normalizeSiteUrl('')).toBe('')
    expect(normalizeSiteUrl(undefined)).toBe('')
    expect(normalizeSiteUrl('javascript:alert(1)')).toBe('')
    expect(normalizeSiteUrl('not a url')).toBe('')
  })

  it('builds canonical URLs only when a base URL is configured', () => {
    expect(canonicalUrl('https://a.test', '/')).toBe('https://a.test/')
    expect(canonicalUrl('https://a.test', '/faq')).toBe('https://a.test/faq')
    expect(canonicalUrl('', '/faq')).toBe('')
  })

  it('writes canonical, OG and robots tags into the marked block', () => {
    const html = applyMeta(template, faq, { siteUrl: 'https://a.test', ogImagePath: '/og.png', ogImageAlt: 'Alt "quoted"' })
    expect(html).toContain('<title>FAQ · Brand Typography Studio</title>')
    expect(html).toContain('<link rel="canonical" href="https://a.test/faq" />')
    expect(html).toContain('property="og:url" content="https://a.test/faq"')
    expect(html).toContain('property="og:image" content="https://a.test/og.png"')
    expect(html).toContain('content="Alt &quot;quoted&quot;"')
    expect(html).toContain('name="robots" content="index,follow"')
  })

  it('omits URLs without a base URL and never canonicalises noindex pages', () => {
    expect(applyMeta(template, faq, { siteUrl: '' })).not.toContain('canonical')
    const html = applyMeta(template, privacy, { siteUrl: 'https://a.test' })
    expect(html).toContain('noindex,nofollow')
    expect(html).not.toContain('canonical')
    expect(headTags({ ...home, title: pageTitle('') }, { siteUrl: '' }).some((t) => t.tag === 'link')).toBe(false)
  })

  it('escapes HTML in descriptions', () => {
    const html = applyMeta(template, { ...faq, description: 'a <b> & "c"' }, { siteUrl: '' })
    expect(html).toContain('a &lt;b&gt; &amp; &quot;c&quot;')
  })

  it('throws when markers are missing', () => {
    expect(() => applyMeta('<head></head>', faq, { siteUrl: '' })).toThrow(/markers/)
  })

  it('lists only indexable pages in the sitemap and disallows the app in robots', () => {
    const sm = buildSitemap('https://a.test')
    expect(sm).toContain('<loc>https://a.test/</loc>')
    expect(sm).toContain('<loc>https://a.test/faq</loc>')
    expect(sm).not.toContain('/privacy')
    expect(sm).not.toContain('/app')
    expect(buildRobots('https://a.test')).toContain('Sitemap: https://a.test/sitemap.xml')
    expect(buildRobots('')).not.toContain('Sitemap')
    expect(buildRobots('')).toContain('Disallow: /app/')
  })
})
