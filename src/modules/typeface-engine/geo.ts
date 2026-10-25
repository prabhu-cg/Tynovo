import type { Dna, GlyphParams } from '@/modules/brand-projects/schema'
import { deriveMetrics, effectiveStrokes, withGlyphParams } from './dna'
import {
  ALL_CORNERS,
  bounds,
  box,
  diff,
  disc,
  extend,
  inter,
  line,
  poly,
  rect,
  ring,
  union,
  type BoxOptions,
  type Corners,
  type Pt,
  type Shape,
  type Side,
} from './geometry/shapes'

/**
 * Construction toolkit handed to every glyph recipe: the glyph's resolved metrics and strokes plus
 * primitives expressed in them. Recipes describe a glyph in terms of "stem", "bar", "bowl" and never
 * touch DNA directly, so changing a parameter reaches every glyph that uses the idea.
 *
 * Coordinates: font units, y up, baseline at 0. Recipes may start x anywhere; spacing is applied later
 * from the actual ink bounds.
 */
export interface Geo {
  dna: Dna
  /** Cap height, x-height, ascender top, descender (negative), overshoot. */
  H: number
  X: number
  A: number
  D: number
  o: number
  /** Vertical-stroke and horizontal-stroke thickness. */
  sv: number
  sh: number
  /** Diagonal stroke thickness (between the two, depending on slope). */
  roundness: number
  W(units: number): number
  snap(v: number): number

  rect(x0: number, y0: number, x1: number, y1: number): Shape
  /** Vertical stroke whose left edge is at x. */
  stem(x: number, y0: number, y1: number): Shape
  /** Vertical stroke whose right edge is at xr. */
  stemR(xr: number, y0: number, y1: number): Shape
  /** Horizontal stroke centred on yc. */
  bar(yc: number, x0: number, x1: number): Shape
  /** Horizontal stroke whose top edge is at yTop. */
  barTop(yTop: number, x0: number, x1: number): Shape
  /** Horizontal stroke whose bottom edge is at yBottom. */
  barBottom(yBottom: number, x0: number, x1: number): Shape
  box(x0: number, y0: number, x1: number, y1: number, round?: Corners): Shape
  ring(x0: number, y0: number, x1: number, y1: number, opts?: BoxOptions): Shape
  /** A diagonal stroke between two centre-line points; ends are extended by ext0 / ext1 so a clip can flatten them. */
  diag(a: Pt, b: Pt, ext0?: number, ext1?: number, thickness?: number): Shape
  /** Clip to a horizontal band. */
  band(s: Shape, y0: number, y1: number): Shape
  /** Clip to a vertical band. */
  vband(s: Shape, x0: number, x1: number): Shape
  /** Dot (round or square depending on roundness). */
  dot(cx: number, cy: number, size: number): Shape
  /**
   * Open a gap in a stroked shape and finish the two stroke ends according to the terminal style.
   * `side` is the side of the shape that opens; the gap spans y in [lo, hi] (right/left) or x in [lo, hi] (top/bottom).
   */
  gap(shape: Shape, side: Side, c: number, lo: number, hi: number, caps?: { lo?: boolean; hi?: boolean }): Shape
}

export function makeGeo(globalDna: Dna, params?: GlyphParams): Geo {
  const dna = withGlyphParams(globalDna, params)
  const m = deriveMetrics(dna)
  const { sv, sh } = effectiveStrokes(globalDna, params)
  const grid = dna.grid
  const snap = (v: number) => (grid > 0 ? Math.round(v / grid) * grid : Math.round(v))
  const roundness = dna.roundness
  const FAR = 4000

  const g: Geo = {
    dna,
    H: m.capHeight,
    X: m.xHeight,
    A: m.capHeight + dna.ascenderRise,
    D: -dna.descenderDepth,
    o: dna.overshoot,
    sv,
    sh,
    roundness,
    W: (units) => snap(units * dna.widthScale),
    snap,

    rect,
    stem: (x, y0, y1) => rect(x, y0, x + sv, y1),
    stemR: (xr, y0, y1) => rect(xr - sv, y0, xr, y1),
    bar: (yc, x0, x1) => rect(x0, yc - sh / 2, x1, yc + sh / 2),
    barTop: (yTop, x0, x1) => rect(x0, yTop - sh, x1, yTop),
    barBottom: (yBottom, x0, x1) => rect(x0, yBottom, x1, yBottom + sh),
    box: (x0, y0, x1, y1, round) => box(x0, y0, x1, y1, roundness, round ?? ALL_CORNERS),
    ring: (x0, y0, x1, y1, opts) => ring(x0, y0, x1, y1, sv, sh, roundness, opts),

    diag(a, b, ext0 = 0, ext1 = ext0, thickness) {
      const [p, q] = extend(a, b, ext0, ext1)
      const angle = Math.atan2(Math.abs(b[1] - a[1]), Math.abs(b[0] - a[0])) // 0 = horizontal, pi/2 = vertical
      const t = thickness ?? sh + (sv - sh) * Math.sin(angle)
      return line(p, q, t, 'butt', 'butt')
    },

    band: (s, y0, y1) => inter(s, rect(-FAR, y0, FAR, y1)),
    vband: (s, x0, x1) => inter(s, rect(x0, -FAR, x1, FAR)),

    dot(cx, cy, size) {
      const h = size / 2
      return roundness >= 0.5 ? box(cx - h, cy - h, cx + h, cy + h, roundness, ALL_CORNERS) : rect(cx - h, cy - h, cx + h, cy + h)
    },

    gap(shape, side, c, lo, hi, caps = { lo: true, hi: true }) {
      const t = dna.terminal
      const vertical = side === 'left' || side === 'right' // the gap spans y and opens towards x
      const outward = side === 'right' || side === 'top' ? 1 : -1
      const far = c + outward * FAR
      const x0 = Math.min(c, far)
      const x1 = Math.max(c, far)
      const flat = (a: number, b: number) => (vertical ? rect(x0, a, x1, b) : rect(a, x0, b, x1))
      // Perpendicular terminals are only built for gaps that open sideways (all the recipes that use them do).
      if (t === 'flat' || !vertical) return diff(shape, flat(lo, hi))

      /** The stroke where a horizontal line at y crosses it: centre-line point, unit tangent (pointing up) and perpendicular width. */
      const probe = (y: number): { m: Pt; t: Pt; w: number } | null => {
        const slice = (yy: number) => {
          const b = bounds(inter(shape, rect(x0, yy - 0.2, x1, yy + 0.2)))
          return b ? { x: (b.minX + b.maxX) / 2, len: b.maxX - b.minX } : null
        }
        const here = slice(y)
        const below = slice(y - 6)
        const above = slice(y + 6)
        if (!here || !below || !above) return null
        // The midpoint of a chord across a band of even width lies on the band's centre line.
        const dx = above.x - below.x
        const n = Math.hypot(dx, 12)
        const ty = 12 / n
        if (ty < 0.25) return null // the stroke runs along the cut: fall back to a flat end
        // The stroke's thickness across its direction is known exactly from the two stroke weights,
        // which is more reliable than a measurement taken along a nearly horizontal stroke.
        const tx = dx / n
        return { m: [here.x, y], t: [tx, ty], w: Math.hypot(sv * ty, sh * tx) }
      }

      const ends: Array<{ at: 'lo' | 'hi'; m: Pt; out: Pt; w: number } | null> = []
      for (const at of ['lo', 'hi'] as const) {
        if (!(at === 'lo' ? caps.lo : caps.hi)) {
          ends.push(null)
          continue
        }
        const level = at === 'lo' ? lo : hi
        let p = probe(level)
        if (p && t === 'round') {
          // Move the cut back by half a stroke so the cap's tip lands on the requested level.
          const shifted = probe(level + (at === 'lo' ? -1 : 1) * (p.w / 2) * p.t[1])
          if (shifted) p = shifted
        }
        ends.push(p ? { at, m: p.m, out: at === 'lo' ? p.t : [-p.t[0], -p.t[1]], w: p.w } : null)
      }

      // Removed region: the part of the gap side lying beyond both stroke ends.
      const beyond = ({ m, out }: { m: Pt; out: Pt }): Shape => {
        const nx = -out[1]
        const ny = out[0]
        return poly([
          [m[0] + nx * FAR, m[1] + ny * FAR],
          [m[0] + nx * FAR + out[0] * FAR * 2, m[1] + ny * FAR + out[1] * FAR * 2],
          [m[0] - nx * FAR + out[0] * FAR * 2, m[1] - ny * FAR + out[1] * FAR * 2],
          [m[0] - nx * FAR, m[1] - ny * FAR],
        ])
      }
      const [loEnd, hiEnd] = ends
      // Beyond each perpendicular end face, plus everything on the centre side of the cap at or past the terminal
      // level, so a tilted face can never leave a sliver of a neighbouring stroke behind.
      const loRegion = loEnd ? union(beyond(loEnd), rect(Math.min(c, loEnd.m[0]), lo, Math.max(c, loEnd.m[0]), FAR)) : flat(lo, FAR)
      const hiRegion = hiEnd ? union(beyond(hiEnd), rect(Math.min(c, hiEnd.m[0]), -FAR, Math.max(c, hiEnd.m[0]), hi)) : flat(-FAR, hi)
      const region = inter(rect(x0, -FAR, x1, FAR), loRegion, hiRegion)
      const opened = diff(shape, region)
      if (t !== 'round') return opened
      const caps2 = ends.filter((e): e is NonNullable<typeof e> => e !== null).map((e) => disc(e.m[0], e.m[1], e.w / 2))
      return union(opened, ...caps2)
    },
  }
  return g
}
