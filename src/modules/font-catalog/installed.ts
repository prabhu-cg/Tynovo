export type Installed = 'installed' | 'not-detected' | 'unknown'

const PROBE = 'mmmmmmmmmmlliWwQq@#0123'
const BASELINES = ['monospace', 'serif', 'sans-serif'] as const

/**
 * Is a family installed on this device? A page cannot ask the system directly, so this measures the same text in
 * the family (falling back to each of three generic families) and in the generic family alone: if the family is
 * not installed the two widths are identical for every generic. It can be wrong for a font whose metrics equal
 * a generic's, so Tynovo calls the answer "detected" or "not detected", never "available".
 * `measure` takes a CSS font shorthand and returns the width of the probe text; null means no way to measure.
 */
export function detectWith(measure: ((font: string) => number) | null, family: string): Installed {
  if (!measure) return 'unknown'
  const quoted = `"${family.replace(/[\\"]/g, '\\$&')}"`
  return BASELINES.some((base) => measure(`72px ${quoted}, ${base}`) !== measure(`72px ${base}`)) ? 'installed' : 'not-detected'
}

const cache = new Map<string, Installed>()

function canvasMeasure(): ((font: string) => number) | null {
  if (typeof document === 'undefined') return null
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return null
  return (font) => {
    ctx.font = font
    return ctx.measureText(PROBE).width
  }
}

/** Browser detection, cached per family for the life of the page. */
export function detectInstalled(family: string): Installed {
  const key = family.toLowerCase()
  const hit = cache.get(key)
  if (hit) return hit
  const result = detectWith(canvasMeasure(), family)
  if (result !== 'unknown') cache.set(key, result)
  return result
}
