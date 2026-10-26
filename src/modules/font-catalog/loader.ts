import { catalogFontById } from './catalog'

/**
 * Loads catalog font files on demand and keeps the number of registered fonts bounded.
 *
 * The files are the studio's own (bundled assets, never a third-party server). Nothing is fetched until a font is
 * needed: fonts that roles use are "pinned" and stay; fonts being previewed in the catalog are "loose", and only
 * the most recent few are kept, the rest are unregistered. A file that cannot be loaded is reported as failed,
 * never as available, and can be retried.
 */
export type LoadState = 'idle' | 'loading' | 'loaded' | 'failed'
export type FontStyleName = 'normal' | 'italic'

export interface FontSpec {
  /** Catalog id, e.g. "inter". */
  id: string
  weight: number
  style: FontStyleName
}

export const specKey = (s: FontSpec) => `${s.id}|${s.weight}|${s.style}`

/** Everything environment-specific, so the loader can be tested without a browser. */
export interface LoaderEnv {
  /** URL of the bundled file, or a rejection when there is none. */
  resolveUrl: (s: FontSpec) => Promise<string>
  /** Fetch and register the font. Rejects when the file cannot be loaded. Returns a handle for removal. */
  register: (family: string, s: FontSpec, url: string) => Promise<{ remove: () => void }>
}

export class FontLoader {
  private readonly env: LoaderEnv
  private readonly maxLoose: number
  private readonly states = new Map<string, { state: LoadState; error?: string }>()
  private readonly handles = new Map<string, { remove: () => void }>()
  private readonly pending = new Map<string, Promise<LoadState>>()
  /** Loose specs in use order, oldest first. */
  private readonly loose: string[] = []
  private pinned = new Set<string>()
  private readonly listeners = new Set<() => void>()
  private version = 0

  constructor(env: LoaderEnv, maxLoose = 8) {
    this.env = env
    this.maxLoose = maxLoose
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }
  /** Changes whenever any state changes; for useSyncExternalStore. */
  snapshot = () => this.version

  private set(key: string, state: LoadState, error?: string) {
    this.states.set(key, error === undefined ? { state } : { state, error })
    this.version++
    for (const l of this.listeners) l()
  }

  state(s: FontSpec): LoadState {
    return this.states.get(specKey(s))?.state ?? 'idle'
  }
  error(s: FontSpec): string | undefined {
    return this.states.get(specKey(s))?.error
  }
  /** How many font files are registered right now. */
  get registered(): number {
    return this.handles.size
  }

  /** The set of fonts that must stay loaded. Everything else becomes evictable. */
  pin(specs: readonly FontSpec[]): void {
    this.pinned = new Set(specs.map(specKey))
    // A font that was pinned and no longer is becomes the oldest loose font.
    for (const key of this.handles.keys()) if (!this.pinned.has(key) && !this.loose.includes(key)) this.loose.unshift(key)
    this.evict()
  }

  /** Load one font file. Resolves with the final state; never rejects. */
  load(spec: FontSpec): Promise<LoadState> {
    const key = specKey(spec)
    const font = catalogFontById(spec.id)
    if (!font) {
      this.set(key, 'failed', `${spec.id} is not in the studio's catalog.`)
      return Promise.resolve('failed')
    }
    const current = this.states.get(key)?.state
    if (current === 'loaded') {
      this.touch(key)
      return Promise.resolve('loaded')
    }
    const inFlight = this.pending.get(key)
    if (inFlight) return inFlight
    this.set(key, 'loading')
    const run = (async (): Promise<LoadState> => {
      try {
        const url = await this.env.resolveUrl(spec)
        const handle = await this.env.register(font.family, spec, url)
        this.handles.set(key, handle)
        this.set(key, 'loaded')
        this.touch(key)
        this.evict()
        return 'loaded'
      } catch (e) {
        this.set(key, 'failed', e instanceof Error ? e.message : 'The font file could not be loaded.')
        return 'failed'
      } finally {
        this.pending.delete(key)
      }
    })()
    this.pending.set(key, run)
    return run
  }

  /** Try again after a failure. */
  retry(spec: FontSpec): Promise<LoadState> {
    if (this.states.get(specKey(spec))?.state === 'failed') this.states.delete(specKey(spec))
    return this.load(spec)
  }

  private touch(key: string) {
    if (this.pinned.has(key)) return
    const i = this.loose.indexOf(key)
    if (i >= 0) this.loose.splice(i, 1)
    this.loose.push(key)
  }

  private evict() {
    // Loose, loaded fonts beyond the limit are unregistered, oldest first. Pinned fonts are never touched.
    const loaded = this.loose.filter((k) => this.handles.has(k) && !this.pinned.has(k))
    for (const key of loaded.slice(0, Math.max(0, loaded.length - this.maxLoose))) {
      this.handles.get(key)?.remove()
      this.handles.delete(key)
      this.loose.splice(this.loose.indexOf(key), 1)
      this.states.delete(key)
      this.version++
    }
    for (const l of this.listeners) l()
  }
}

/* ---------- the browser environment ---------- */

// Vite turns these into one lazy import per file; nothing is fetched until a font is requested.
const files = import.meta.glob('/node_modules/@fontsource/*/files/*-latin-{300,400,500,600,700,800,900}-normal.woff2', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>
const italics = import.meta.glob('/node_modules/@fontsource/*/files/*-latin-400-italic.woff2', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>

export const bundledFileKey = (s: FontSpec) => `/node_modules/@fontsource/${s.id}/files/${s.id}-latin-${s.weight}-${s.style}.woff2`

const browserEnv: LoaderEnv = {
  async resolveUrl(s) {
    const load = (s.style === 'italic' ? italics : files)[bundledFileKey(s)]
    if (!load) throw new Error(`The studio has no ${s.weight} ${s.style} file for this font.`)
    return load()
  },
  async register(family, s, url) {
    if (typeof FontFace === 'undefined') throw new Error('This browser cannot register fonts.')
    const face = new FontFace(family, `url(${JSON.stringify(url)}) format("woff2")`, { weight: String(s.weight), style: s.style, display: 'swap' })
    await face.load()
    document.fonts.add(face)
    return { remove: () => void document.fonts.delete(face) }
  },
}

/** The one loader the app uses. */
export const fontLoader = new FontLoader(browserEnv)

/** Weight the browser would pick for a request, given the weights that exist (CSS font matching, upright). */
export function nearestWeight(available: readonly number[], wanted: number): number {
  if (available.length === 0) return wanted
  if (available.includes(wanted)) return wanted
  const sorted = [...available].sort((a, b) => a - b)
  if (wanted >= 400 && wanted <= 500) {
    // 400-500: look up to 500 first, then below, then above.
    const up = sorted.find((w) => w > wanted && w <= 500)
    if (up !== undefined) return up
  }
  if (wanted <= 500) {
    const below = [...sorted].reverse().find((w) => w < wanted)
    if (below !== undefined) return below
    return sorted.find((w) => w > wanted) ?? sorted[0]!
  }
  const above = sorted.find((w) => w > wanted)
  if (above !== undefined) return above
  return [...sorted].reverse().find((w) => w < wanted) ?? sorted.at(-1)!
}
