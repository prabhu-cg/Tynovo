import polygonClipping from 'polygon-clipping'

/**
 * Plane geometry for glyph construction. Coordinates are font units, y up.
 * A Shape is a MultiPolygon: polygons of [outer ring, ...hole rings]. Booleans come from
 * polygon-clipping, so a union never leaves overlapping or self-intersecting contours.
 * Pure functions: nothing here knows about fonts, DNA or rendering.
 */
export type Pt = [number, number]
export type Ring = Pt[]
export type Shape = Array<Ring[]>

export const EMPTY: Shape = []
export const isEmpty = (s: Shape) => s.length === 0

const live = (shapes: Shape[]) => shapes.filter((s) => s.length > 0)

/**
 * polygon-clipping fails on coordinates that are almost, but not exactly, equal (189 vs 188.99999999999997).
 * Quantising inputs makes near-equal values exactly equal. Rings that collapse are dropped.
 */
function quantize(s: Shape, q: number): Shape {
  const out: Shape = []
  for (const polygon of s) {
    const rings: Ring[] = []
    for (const ring of polygon) {
      const pts: Ring = []
      for (const [x, y] of ring) {
        const p: Pt = [Math.round(x / q) * q, Math.round(y / q) * q]
        const last = pts[pts.length - 1]
        if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p)
      }
      if (pts.length > 1 && pts[0]![0] === pts[pts.length - 1]![0] && pts[0]![1] === pts[pts.length - 1]![1]) pts.pop()
      if (pts.length >= 3) rings.push(pts)
      else if (rings.length === 0) break // the outer ring collapsed: the polygon is gone
    }
    if (rings.length > 0) out.push(rings)
  }
  return out
}

/** Run a boolean operation on quantised inputs, retrying on coarser grids if the library rejects them. */
function robust(op: (inputs: Shape[]) => Shape, inputs: Shape[]): Shape {
  let lastError: unknown
  for (const q of [0.001, 0.01, 0.1]) {
    try {
      return op(inputs.map((i) => quantize(i, q)).filter((i) => i.length > 0))
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

export function union(...shapes: Shape[]): Shape {
  const parts = live(shapes)
  if (parts.length === 0) return []
  if (parts.length === 1) return parts[0]!
  return robust(([first, ...rest]) => (first ? (polygonClipping.union(first, ...rest) as Shape) : []), parts)
}

export function diff(subject: Shape, ...cuts: Shape[]): Shape {
  const c = live(cuts)
  if (subject.length === 0) return []
  if (c.length === 0) return subject
  return robust(([first, ...rest]) => (first ? (polygonClipping.difference(first, ...rest) as Shape) : []), [subject, ...c])
}

export function inter(subject: Shape, ...others: Shape[]): Shape {
  if (subject.length === 0) return []
  let out = subject
  for (const o of others) {
    if (o.length === 0) return []
    out = robust(([a, b]) => (a && b ? (polygonClipping.intersection(a, b) as Shape) : []), [out, o])
    if (out.length === 0) return []
  }
  return out
}

/** Self-union: resolves overlaps and folds in a single shape. */
export function normalize(s: Shape): Shape {
  if (s.length === 0) return []
  return robust(([a]) => (a ? (polygonClipping.union(a) as Shape) : []), [s])
}

const isWhole = (s: Shape) => s.every((polygon) => polygon.every((ring) => ring.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y))))

/**
 * Round every coordinate to a whole font unit and re-normalise, repeating until the result is whole.
 * Rounding can fold sub-unit features onto themselves; the self-union dissolves those folds.
 */
export function toWholeUnits(s: Shape): Shape {
  let cur = s
  for (let i = 0; i < 4 && cur.length > 0; i++) {
    cur = normalize(mapPoints(cur, ([x, y]) => [Math.round(x), Math.round(y)]))
    if (isWhole(cur)) break
  }
  return cur
}

export const poly = (ring: Ring): Shape => [[ring]]

export const rect = (x0: number, y0: number, x1: number, y1: number): Shape =>
  x1 <= x0 || y1 <= y0
    ? []
    : poly([
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ])

export const mapPoints = (s: Shape, f: (p: Pt) => Pt): Shape => s.map((polygon) => polygon.map((ring) => ring.map(f)))

export const move = (s: Shape, dx: number, dy: number): Shape => mapPoints(s, ([x, y]) => [x + dx, y + dy])

/** Mirror left-right about the vertical line x = axis. */
export const mirrorX = (s: Shape, axis: number): Shape => mapPoints(s, ([x, y]) => [2 * axis - x, y])

/** Rotate 180 degrees about (cx, cy). */
export const rotate180 = (s: Shape, cx: number, cy: number): Shape => mapPoints(s, ([x, y]) => [2 * cx - x, 2 * cy - y])

export function bounds(s: Shape): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let b: { minX: number; minY: number; maxX: number; maxY: number } | null = null
  for (const polygon of s)
    for (const ring of polygon)
      for (const [x, y] of ring)
        b = b
          ? { minX: Math.min(b.minX, x), minY: Math.min(b.minY, y), maxX: Math.max(b.maxX, x), maxY: Math.max(b.maxY, y) }
          : { minX: x, minY: y, maxX: x, maxY: y }
  return b
}

/* ---------- curves ---------- */

const rad = (deg: number) => (deg * Math.PI) / 180

/** Points on an ellipse arc from a0 to a1 degrees (CCW positive), endpoints included. */
export function arcPoints(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, segments: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= segments; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / segments)
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)])
  }
  return out
}

/** Segments for a quarter arc of the given radius: fixed rule, so output is deterministic. */
export const quarterSegments = (r: number) => Math.min(16, Math.max(6, Math.ceil(r / 12)))

/* ---------- boxes and rings ---------- */

export interface Corners {
  tl?: boolean
  tr?: boolean
  br?: boolean
  bl?: boolean
}

export const ALL_CORNERS: Required<Corners> = { tl: true, tr: true, br: true, bl: true }

export interface CornerRadii {
  tl: [number, number]
  tr: [number, number]
  br: [number, number]
  bl: [number, number]
}

/**
 * Radii for each rounded corner. A corner may use the full width/height only when its neighbour
 * along that axis is square; when the other axis is square the radius is kept circular.
 * `roundness` 1 gives ellipses/stadiums, 0 gives square corners.
 */
export function cornerRadii(w: number, h: number, c: Corners, roundness: number): CornerRadii {
  const radii: CornerRadii = { tl: [0, 0], tr: [0, 0], br: [0, 0], bl: [0, 0] }
  const one = (corner: keyof Corners, hNeighbour: boolean | undefined, vNeighbour: boolean | undefined) => {
    if (!c[corner]) return
    let cw = hNeighbour ? w / 2 : w
    let ch = vNeighbour ? h / 2 : h
    if (!hNeighbour) cw = Math.min(cw, ch)
    if (!vNeighbour) ch = Math.min(ch, cw)
    radii[corner] = [roundness * cw, roundness * ch]
  }
  one('tl', c.tr, c.bl)
  one('tr', c.tl, c.br)
  one('br', c.bl, c.tr)
  one('bl', c.br, c.tl)
  return radii
}

/** Outline of a box with the given corner radii, counter-clockwise from the bottom-left corner. */
export function boxRing(x0: number, y0: number, x1: number, y1: number, r: CornerRadii): Ring {
  const out: Ring = []
  const corner = (cx: number, cy: number, [rx, ry]: [number, number], a0: number, a1: number, sharp: Pt) => {
    if (rx < 0.5 || ry < 0.5) {
      out.push(sharp)
      return
    }
    out.push(...arcPoints(cx, cy, rx, ry, a0, a1, quarterSegments(Math.max(rx, ry))))
  }
  corner(x0 + r.bl[0], y0 + r.bl[1], r.bl, 180, 270, [x0, y0])
  corner(x1 - r.br[0], y0 + r.br[1], r.br, 270, 360, [x1, y0])
  corner(x1 - r.tr[0], y1 - r.tr[1], r.tr, 0, 90, [x1, y1])
  corner(x0 + r.tl[0], y1 - r.tl[1], r.tl, 90, 180, [x0, y1])
  // Drop consecutive duplicates (where an arc ends exactly where the next begins).
  return out.filter((p, i) => {
    const q = out[(i + out.length - 1) % out.length]!
    return Math.abs(p[0] - q[0]) > 1e-6 || Math.abs(p[1] - q[1]) > 1e-6
  })
}

export type Side = 'top' | 'bottom' | 'left' | 'right'

export interface BoxOptions {
  round?: Corners
  /** Sides with no stroke: the counter runs through them. Corners touching an open side stay square. */
  open?: Side[]
}

/** A filled box with rounded corners. */
export function box(x0: number, y0: number, x1: number, y1: number, roundness: number, round: Corners = ALL_CORNERS): Shape {
  const r = cornerRadii(x1 - x0, y1 - y0, round, roundness)
  return poly(boxRing(x0, y0, x1, y1, r))
}

/**
 * A stroked box: outer shape minus a concentric counter. `tv` is the thickness of left/right strokes,
 * `th` of top/bottom strokes. Counter corner radii shrink by the stroke so strokes keep an even weight.
 */
export function ring(x0: number, y0: number, x1: number, y1: number, tv: number, th: number, roundness: number, opts: BoxOptions = {}): Shape {
  const open = new Set(opts.open ?? [])
  const round = { ...ALL_CORNERS, ...opts.round }
  if (open.has('top')) round.tl = round.tr = false
  if (open.has('bottom')) round.bl = round.br = false
  if (open.has('left')) round.tl = round.bl = false
  if (open.has('right')) round.tr = round.br = false

  const w = x1 - x0
  const h = y1 - y0
  const outerR = cornerRadii(w, h, round, roundness)
  const outer = poly(boxRing(x0, y0, x1, y1, outerR))

  // The counter is the box inset by the stroke on every closed side. Its corner radii come from its own
  // size (never larger than the box), so narrow counters stay valid. Open sides extend the counter
  // beyond the outline so it cuts straight through.
  const nx0 = open.has('left') ? x0 : x0 + tv
  const nx1 = open.has('right') ? x1 : x1 - tv
  const ny0 = open.has('bottom') ? y0 : y0 + th
  const ny1 = open.has('top') ? y1 : y1 - th
  if (nx1 - nx0 <= 0 || ny1 - ny0 <= 0) return outer // stroke fills the box
  const innerR = cornerRadii(nx1 - nx0, ny1 - ny0, round, roundness)
  const ext = Math.max(w, h)
  const inner = poly(
    boxRing(open.has('left') ? x0 - ext : nx0, open.has('bottom') ? y0 - ext : ny0, open.has('right') ? x1 + ext : nx1, open.has('top') ? y1 + ext : ny1, innerR),
  )
  return diff(outer, inner)
}

/* ---------- straight strokes ---------- */

export type Cap = 'butt' | 'round' | 'square'

/** A straight stroke of constant thickness along p0 to p1. */
export function line(p0: Pt, p1: Pt, thickness: number, cap0: Cap = 'butt', cap1: Cap = 'butt'): Shape {
  const dx = p1[0] - p0[0]
  const dy = p1[1] - p0[1]
  const len = Math.hypot(dx, dy)
  if (len < 1e-9 || thickness <= 0) return []
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux
  const h = thickness / 2
  const a: Pt = cap0 === 'square' ? [p0[0] - ux * h, p0[1] - uy * h] : p0
  const b: Pt = cap1 === 'square' ? [p1[0] + ux * h, p1[1] + uy * h] : p1
  const angle = (Math.atan2(uy, ux) * 180) / Math.PI
  const out: Ring = []
  // End cap, from the left edge round the front to the right edge.
  if (cap1 === 'round') out.push(...arcPoints(b[0], b[1], h, h, angle + 90, angle - 90, 10))
  else out.push([b[0] + nx * h, b[1] + ny * h], [b[0] - nx * h, b[1] - ny * h])
  // Start cap, from the right edge round the back to the left edge.
  if (cap0 === 'round') out.push(...arcPoints(a[0], a[1], h, h, angle - 90, angle - 270, 10))
  else out.push([a[0] - nx * h, a[1] - ny * h], [a[0] + nx * h, a[1] + ny * h])
  return poly(out)
}

/** Extend segment endpoints outward so a later clip produces flat ends. */
export function extend(p0: Pt, p1: Pt, e0: number, e1 = e0): [Pt, Pt] {
  const dx = p1[0] - p0[0]
  const dy = p1[1] - p0[1]
  const len = Math.hypot(dx, dy) || 1
  return [
    [p0[0] - (dx / len) * e0, p0[1] - (dy / len) * e0],
    [p1[0] + (dx / len) * e1, p1[1] + (dy / len) * e1],
  ]
}

export const disc = (cx: number, cy: number, r: number): Shape => poly(arcPoints(cx, cy, r, r, 0, 360, 36).slice(0, -1))
