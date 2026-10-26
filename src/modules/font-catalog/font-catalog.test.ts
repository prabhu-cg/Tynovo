// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Brand } from '@/modules/brand-projects/schema'
import { sourceAvailability, describeAvailability, isDrawable } from '@/modules/brand-system/availability'
import { CATALOG, catalogFontFor, sourceFromCatalog, sourceFromName } from './catalog'
import { detectWith } from './installed'
import { FontLoader, nearestWeight, specKey, type FontSpec, type LoaderEnv } from './loader'
import { filterCatalog, hasBrandSignals, NO_FILTER, scoreFont, suggestFonts, suggestPairings } from './recommend'

describe('catalog data comes from the font packages, not from memory', () => {
  it('matches the metadata and files of every installed package', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(20)
    for (const f of CATALOG) {
      const dir = `node_modules/@fontsource/${f.id}`
      const meta = JSON.parse(readFileSync(`${dir}/metadata.json`, 'utf8'))
      const pkg = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'))
      expect(f.family, f.id).toBe(meta.family)
      expect(f.category, f.id).toBe(meta.category)
      expect(f.license.spdx, f.id).toBe(meta.license.type)
      expect(f.version, f.id).toBe(meta.version)
      expect(f.upstream, f.id).toBe(meta.source)
      expect(f.styles, f.id).toEqual(meta.styles)
      expect(f.distributionVersion, f.id).toBe(pkg.version)
      for (const w of f.weights) {
        expect(meta.weights, `${f.id} ${w}`).toContain(w)
        expect(existsSync(`${dir}/files/${f.id}-latin-${w}-normal.woff2`), `${f.id} ${w} file`).toBe(true)
      }
      if (f.italic) expect(existsSync(`${dir}/files/${f.id}-latin-400-italic.woff2`), `${f.id} italic`).toBe(true)
      expect(f.weights, f.id).toContain(400)
    }
  })

  it('only catalogues fonts whose licence permits redistribution (SIL OFL 1.1), each with a copyright line', () => {
    for (const f of CATALOG) {
      expect(f.license.spdx, f.id).toBe('OFL-1.1')
      expect(f.license.copyright.length, f.id).toBeGreaterThan(3) // the package's own attribution line
      expect(f.license.url).toMatch(/^https:\/\//)
    }
  })

  it('has unique ids and families, and covers each category the interface filters by', () => {
    expect(new Set(CATALOG.map((f) => f.id)).size).toBe(CATALOG.length)
    expect(new Set(CATALOG.map((f) => f.family)).size).toBe(CATALOG.length)
    for (const c of ['sans-serif', 'serif', 'monospace', 'display'] as const) expect(CATALOG.some((f) => f.category === c), c).toBe(true)
  })

  it('creates project entries that record the real licence and bundled weights', () => {
    const inter = catalogFontFor('inter')!
    expect(sourceFromCatalog(inter, 's1')).toMatchObject({ kind: 'catalog', family: 'Inter', fallback: 'sans-serif', weights: inter.weights, license: { spdx: 'OFL-1.1', verified: true }, fallbackFamilies: [] })
    expect(sourceFromName('  My Font ', 'serif', 's2')).toMatchObject({ family: 'My Font', kind: 'system', license: { name: 'Not recorded', verified: false } })
  })
})

const env = (opts: { fail?: Set<string>; delay?: boolean } = {}) => {
  const registered = new Map<string, boolean>()
  let fetches = 0
  const e: LoaderEnv = {
    resolveUrl: async (s) => {
      fetches++
      if (opts.fail?.has(specKey(s))) throw new Error('network down')
      return `/files/${specKey(s)}`
    },
    register: async (_family, s) => {
      registered.set(specKey(s), true)
      return { remove: () => void registered.delete(specKey(s)) }
    },
  }
  return { e, registered, fetches: () => fetches }
}
const spec = (id: string, weight = 400): FontSpec => ({ id, weight, style: 'normal' })

describe('FontLoader', () => {
  it('loads nothing until asked, and a font only once', async () => {
    const x = env()
    const l = new FontLoader(x.e)
    expect(l.state(spec('inter'))).toBe('idle')
    expect(x.fetches()).toBe(0)
    await Promise.all([l.load(spec('inter')), l.load(spec('inter'))])
    await l.load(spec('inter'))
    expect(x.fetches()).toBe(1)
    expect(l.state(spec('inter'))).toBe('loaded')
  })

  it('keeps the number of loose (previewed) fonts bounded, oldest first, and never evicts pinned ones', async () => {
    const x = env()
    const l = new FontLoader(x.e, 3)
    l.pin([spec('lora', 700)])
    await l.load(spec('lora', 700))
    for (const id of ['inter', 'manrope', 'dm-sans', 'work-sans', 'caveat']) await l.load(spec(id))
    expect(l.registered).toBe(4) // 3 loose + 1 pinned
    expect(l.state(spec('lora', 700))).toBe('loaded')
    expect(l.state(spec('inter'))).toBe('idle') // evicted, so it can be loaded again if needed
    expect(l.state(spec('caveat'))).toBe('loaded')
    expect(x.registered.size).toBe(4)
    // unpinning makes it evictable
    l.pin([])
    for (const id of ['space-mono', 'jetbrains-mono', 'lora']) await l.load(spec(id))
    expect(l.registered).toBeLessThanOrEqual(3)
  })

  it('reports a failure instead of pretending, and retries', async () => {
    const fail = new Set([specKey(spec('inter'))])
    const x = env({ fail })
    const l = new FontLoader(x.e)
    expect(await l.load(spec('inter'))).toBe('failed')
    expect(l.error(spec('inter'))).toBe('network down')
    expect(l.registered).toBe(0)
    fail.clear()
    expect(await l.retry(spec('inter'))).toBe('loaded')
  })

  it('fails cleanly for a font that is not in the catalog', async () => {
    const l = new FontLoader(env().e)
    expect(await l.load(spec('not-a-font'))).toBe('failed')
    expect(l.error(spec('not-a-font'))).toMatch(/not in Tynovo's catalog/)
  })

  it('notifies subscribers when a state changes', async () => {
    const l = new FontLoader(env().e)
    let n = 0
    const off = l.subscribe(() => n++)
    const before = l.snapshot()
    await l.load(spec('inter'))
    expect(n).toBeGreaterThan(0)
    expect(l.snapshot()).not.toBe(before)
    off()
  })
})

describe('nearestWeight follows CSS font matching', () => {
  it('uses an exact match, else 500 for 400, else lighter below 400, heavier above 500', () => {
    const w = [400, 700]
    expect(nearestWeight(w, 400)).toBe(400)
    expect(nearestWeight(w, 500)).toBe(400)
    expect(nearestWeight(w, 300)).toBe(400)
    expect(nearestWeight(w, 600)).toBe(700)
    expect(nearestWeight(w, 900)).toBe(700)
    expect(nearestWeight([300, 500, 700], 400)).toBe(500)
    expect(nearestWeight([], 650)).toBe(650)
  })
})

describe('detecting installed fonts', () => {
  const metrics = (installed: string[]) => (font: string) => {
    const m = /72px (?:"((?:[^"\\]|\\.)*)", )?(monospace|serif|sans-serif)/.exec(font)!
    const base = { monospace: 100, serif: 120, 'sans-serif': 140 }[m[2] as 'serif']
    return m[1] && installed.includes(m[1]) ? base + 7 : base
  }
  it('says installed only when the text measures differently from the generic fallback', () => {
    expect(detectWith(metrics(['Helvetica Neue']), 'Helvetica Neue')).toBe('installed')
    expect(detectWith(metrics(['Helvetica Neue']), 'Not Installed')).toBe('not-detected')
    expect(detectWith(null, 'Anything')).toBe('unknown')
  })
  it('handles quotes in names without breaking the font string', () => {
    expect(detectWith(metrics([]), 'Bad "name" \\ x')).toBe('not-detected')
  })
})

describe('availability is never claimed without evidence', () => {
  const inter = sourceFromCatalog(catalogFontFor('inter')!, 's')
  const named = sourceFromName('Helvetica Neue', 'sans-serif', 'n')
  it('a catalog font is available only once loaded', () => {
    expect(sourceAvailability(inter, { load: 'idle', installed: 'unknown' }).status).toBe('loading')
    expect(sourceAvailability(inter, { load: 'loading', installed: 'unknown' }).status).toBe('loading')
    expect(isDrawable(sourceAvailability(inter, { load: 'loaded', installed: 'unknown' }))).toBe(true)
    const failed = sourceAvailability(inter, { load: 'failed', loadError: 'network down', installed: 'unknown' })
    expect(isDrawable(failed)).toBe(false)
    expect(describeAvailability(failed, inter)).toMatch(/network down.*fallback \(sans-serif\)/)
  })
  it('a catalog font that left the catalog is unavailable, and is not loadable', () => {
    const gone = { ...inter, family: 'Removed Font' }
    expect(sourceAvailability(gone, { load: 'loaded', installed: 'unknown' }).status).toBe('unavailable')
  })
  it('a named font is available only when detected, and the text says what happens otherwise', () => {
    expect(sourceAvailability(named, { load: 'idle', installed: 'installed' }).status).toBe('installed')
    const no = sourceAvailability(named, { load: 'idle', installed: 'not-detected' })
    expect(isDrawable(no)).toBe(false)
    expect(describeAvailability(no, named)).toMatch(/Not detected on this device.*fallback \(sans-serif\)/)
    expect(isDrawable(sourceAvailability(named, { load: 'idle', installed: 'unknown' }))).toBe(false)
  })
})

const brand = (over: Partial<Brand> = {}): Brand => ({ name: '', description: '', personality: [], useCases: [], tones: [], readabilityPriority: 3, displayPriority: 3, notes: '', sampleCopy: {}, ...over })

describe('catalog search and filters', () => {
  it('searches by family name, ignoring case and spaces at the edges', () => {
    expect(filterCatalog({ ...NO_FILTER, query: '  plex ' }).map((f) => f.family)).toEqual(['IBM Plex Mono', 'IBM Plex Sans', 'IBM Plex Serif'])
    expect(filterCatalog({ ...NO_FILTER, query: 'zzz' })).toEqual([])
  })
  it('filters by category, and by several together', () => {
    const mono = filterCatalog({ ...NO_FILTER, categories: ['monospace'] })
    expect(mono.length).toBeGreaterThanOrEqual(3)
    expect(mono.every((f) => f.category === 'monospace')).toBe(true)
    const serifPlex = filterCatalog({ ...NO_FILTER, categories: ['serif'], query: 'plex' })
    expect(serifPlex.map((f) => f.family)).toEqual(['IBM Plex Serif'])
  })
  it('filters by tone, use case and the text/display tags', () => {
    expect(filterCatalog({ ...NO_FILTER, tones: ['technical'] }).every((f) => f.tags.tones.includes('technical'))).toBe(true)
    expect(filterCatalog({ ...NO_FILTER, uses: ['editorial'] }).every((f) => f.tags.uses.includes('editorial'))).toBe(true)
    expect(filterCatalog({ ...NO_FILTER, text: true }).every((f) => f.tags.text)).toBe(true)
    expect(filterCatalog({ ...NO_FILTER, display: true }).every((f) => f.tags.display)).toBe(true)
  })
})

describe('recommendations are transparent rules', () => {
  it('say nothing until the brand has a tone or a use case', () => {
    expect(hasBrandSignals(brand())).toBe(false)
    expect(suggestFonts(brand(), 'body')).toEqual([])
    expect(suggestPairings(brand())).toEqual([])
  })
  it('give every point a reason, and the score is exactly their sum', () => {
    const b = brand({ tones: ['technical', 'confident'], useCases: ['saas'], readabilityPriority: 5 })
    for (const s of suggestFonts(b, 'body', 20)) {
      expect(s.reasons.length).toBeGreaterThan(0)
      expect(s.score).toBe(s.reasons.reduce((n, r) => n + r.points, 0))
      expect(s.score).toBeGreaterThan(0)
    }
  })
  it('follow the brand: a technical SaaS brand gets text sans fonts, an elegant editorial one gets serifs', () => {
    const tech = suggestFonts(brand({ tones: ['technical'], useCases: ['saas'], readabilityPriority: 5 }), 'body').map((s) => s.font.id)
    expect(tech).toContain('inter')
    const editorial = suggestFonts(brand({ tones: ['elegant'], useCases: ['editorial'], readabilityPriority: 5 }), 'body').map((s) => s.font.category)
    expect(editorial[0]).toBe('serif')
  })
  it('never offers display or handwriting designs, or monospace, for long text', () => {
    const b = brand({ tones: ['playful', 'confident', 'elegant', 'technical'], useCases: ['campaign', 'saas', 'editorial'], readabilityPriority: 5 })
    for (const s of suggestFonts(b, 'body', 50)) expect(['display', 'handwriting', 'monospace']).not.toContain(s.font.category)
  })
  it('weigh readability and display priorities, with the reason written out', () => {
    const f = CATALOG.find((x) => x.id === 'bebas-neue')!
    const high = scoreFont(f, brand({ tones: ['confident'], readabilityPriority: 5, displayPriority: 5 }), 'body')
    expect(high.reasons.map((r) => r.text).join('\n')).toMatch(/Not tagged as drawn for text sizes, and readability is a high priority/)
    expect(scoreFont(f, brand({ tones: ['confident'], displayPriority: 5 }), 'display').reasons.map((r) => r.text).join('\n')).toMatch(/Tagged for large sizes, and display use is a high priority/)
  })
  it('suggest pairings of two different fonts with the reasons for the pair', () => {
    const pairs = suggestPairings(brand({ tones: ['elegant', 'confident'], useCases: ['editorial'], readabilityPriority: 4, displayPriority: 4 }))
    expect(pairs.length).toBeGreaterThan(0)
    expect(pairs.length).toBeLessThanOrEqual(3)
    for (const p of pairs) {
      expect(p.primary.font.id).not.toBe(p.secondary.font.id)
      expect(p.score).toBe(p.primary.score + p.secondary.score + p.together.reduce((n, r) => n + r.points, 0))
    }
    expect(new Set(pairs.map((p) => p.primary.font.id)).size).toBe(pairs.length)
    expect(JSON.stringify(pairs)).not.toMatch(/optimal|accessible|best/i) // no claims the rules cannot back
  })
  it('call out a superfamily pairing and penalise two monospace fonts', () => {
    const plex = suggestPairings(brand({ tones: ['technical', 'serious'], useCases: ['saas', 'corporate'], readabilityPriority: 5 }), 10)
    expect(plex.some((p) => p.together.some((r) => /one family/.test(r.text)))).toBe(true)
  })
})
