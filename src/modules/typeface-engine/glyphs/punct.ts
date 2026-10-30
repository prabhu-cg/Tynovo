import type { Geo } from '../geo'
import { inter, mapPoints, mirrorX, move, normalize, poly, union, type Pt, type Shape } from '../geometry/shapes'
import { dotSize, sCurve } from './parts'
import { spec, type SpecTable } from './types'

const comma = (g: Geo): Shape => {
  const d = dotSize(g)
  // The tail may hang below the baseline only as far as the descender allows.
  const drop = Math.min(d * 1.05, -g.D + g.o - 4 - d * 0.25)
  const tail = g.diag([d * 0.62, d * 0.3], [d * 0.12, -drop], 0, 0, d * 0.62)
  return union(g.dot(d / 2, d / 2, d), tail)
}


const ringArea = (r: Pt[]): number => Math.abs(r.reduce((sum, [x, y], i) => sum + x * r[(i + 1) % r.length]![1] - r[(i + 1) % r.length]![0] * y, 0)) / 2

/** Drops holes smaller than `minArea` (font units squared): too small to read as a counter. */
const withoutSlivers = (s: Shape, minArea: number): Shape => s.map(([outer, ...holes]) => [outer!, ...holes.filter((h) => ringArea(h) >= minArea)])

/** Left half of a curly brace: the top hook, the upper stem and the point, as ink above the mid-line `yc`. */
const braceUpper = (g: Geo, w: number, yc: number): Shape => {
  const { A, sv, sh } = g
  const sx = (w - sv) / 2
  // Hook and point radius: reaches exactly from the stem to the glyph's edges, and never more than the room above the mid-line.
  const r = Math.min((w + sv) / 2, (A - yc) / 2 - 2)
  const hook = g.vband(g.band(g.ring(sx, A - 2 * r, sx + 2 * r, A), A - r, A), sx, sx + r)
  const point = g.vband(g.band(g.ring(sx + sv - 2 * r, yc - sh / 2, sx + sv, yc - sh / 2 + 2 * r), yc - sh / 2, yc - sh / 2 + r), sx + sv - r, sx + sv)
  return union(hook, point, g.stem(sx, yc - sh / 2 + r, A - r), g.bar(yc, 0, sx + sv - r + 1), g.barTop(A, sx + r - 1, w))
}

const braceLeft = (g: Geo): Shape => {
  const w = g.W(300)
  const yc = (g.A + g.D * 0.75) / 2
  const up = braceUpper(g, w, yc)
  const down = normalize(mapPoints(up, ([x, y]) => [x, 2 * yc - y]))
  return union(up, down)
}

/** Vertical tick used by apostrophe and quotes. */
const tick = (g: Geo, x: number): Shape => g.stem(x, g.H * 0.66, g.H)

export const punct: SpecTable = {
  '!': spec((g) => {
    const d = dotSize(g)
    return union(g.dot(d / 2, d / 2, d), g.stem((d - g.sv) / 2, g.H * 0.3, g.H))
  }),
  '"': spec((g) => union(tick(g, 0), tick(g, g.sv * 2))),
  '#': spec((g) => {
    const { H } = g
    const w = g.W(560)
    const top = H * 0.9
    return union(g.stem(w * 0.2, 0, top), g.stem(w * 0.62, 0, top), g.bar(H * 0.3, 0, w + g.sv), g.bar(H * 0.62, 0, w + g.sv))
  }),
  $: spec((g) => {
    const { H, o } = g
    const w = g.W(520)
    // The bar of the dollar sign pokes out above and below, but never past the font's vertical metrics.
    const up = g.dna.ascenderRise + o
    const down = Math.min(g.dna.ascenderRise, g.dna.descenderDepth) + o
    return union(sCurve(g, w, -o, H + o, g.dna.aperture * H), g.stem((w - g.sv) / 2, -down, H + up))
  }, 'round'),
  '%': spec((g) => {
    const { H } = g
    const dd = Math.round(H * 0.4)
    const w = g.W(780)
    const slash = g.band(g.diag([w * 0.78, H], [w * 0.22, 0], H * 0.1), 0, H)
    return union(g.ring(0, H - dd, dd, H), g.ring(w - dd, 0, w, dd), slash)
  }, 'round'),
  "'": spec((g) => tick(g, 0)),
  '&': spec((g) => {
    const { H, o, sv, sh } = g
    const w = g.W(720)
    const split = H * 0.56
    const upper = g.ring(w * 0.07, split - sh / 2, w * 0.6, H + o)
    const lower = g.ring(0, -o, w * 0.8, split + sh / 2)
    // The long stroke starts inside the shared bar between the bowls and runs down to the foot at the lower right.
    const leg = g.band(g.diag([w * 0.42, split], [w - sv * 0.6, 0], H * 0.12), 0, split + sh / 2)
    // Where the leg crosses the bowl's shoulder a chamfered or very heavy design can leave a sliver of counter; it is filled in.
    return withoutSlivers(union(upper, lower, leg), sv * sh * 0.5)
  }, 'round', 'diagonal'),
  '@': spec((g) => {
    const { H, D } = g
    const w = g.W(820)
    const y0 = D * 0.25
    const y1 = H + g.o
    const mid = (y0 + y1) / 2
    const ih = (y1 - y0) * 0.46
    const ix0 = w * 0.27
    const ix1 = w * 0.73
    // The shell is open at the lower right; the stem of the inner "a" runs down to meet it.
    const shell = g.gap(g.ring(0, y0, w, y1), 'right', ix1, y0 - 2000, y0 + (y1 - y0) * 0.34, { lo: false, hi: true })
    const bowl = g.ring(ix0, mid - ih / 2, ix1, mid + ih / 2)
    // Trimmed to the shell's outline so the stem does not hang below the curve.
    return union(shell, bowl, inter(g.stemR(ix1, y0, mid + ih / 2), g.box(0, y0, w, y1)))
  }, 'round', 'round'),
  '{': spec(braceLeft, 'round', 'open'),
  '}': spec((g) => {
    const w = g.W(300)
    return normalize(mirrorX(braceLeft(g), w / 2))
  }, 'open', 'round'),
  '~': spec((g) => {
    const { X, sh } = g
    const w = g.W(620)
    const yc = X * 0.55
    const amp = sh * 1.1
    // One full sine period as a band of even vertical thickness, so the ends are cut flat and the join is seamless.
    const n = 48
    const t = Math.round(sh * 1.05)
    const wave = (i: number): number => yc + amp * Math.sin((2 * Math.PI * i) / n)
    const top: Pt[] = Array.from({ length: n + 1 }, (_, i) => [(w * i) / n, wave(i) + t / 2])
    const bottom: Pt[] = Array.from({ length: n + 1 }, (_, i) => [(w * (n - i)) / n, wave(n - i) - t / 2])
    return normalize(poly([...top, ...bottom]))
  }, 'open'),
  '(': spec((g) => {
    const { A, D } = g
    const pw = g.W(300)
    return g.vband(g.ring(0, D * 0.75, pw * 2, A), 0, pw)
  }, 'round', 'open'),
  ')': spec((g) => {
    const { A, D } = g
    const pw = g.W(300)
    return g.vband(g.ring(-pw, D * 0.75, pw, A), 0, pw)
  }, 'open', 'round'),
  '*': spec((g) => {
    const c: Pt = [0, 0]
    const r = Math.min(g.W(190), Math.round(g.H * 0.26))
    const spoke = (deg: number) => {
      const a = (deg * Math.PI) / 180
      return g.diag([c[0] - Math.cos(a) * r, c[1] - Math.sin(a) * r], [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r], 0, 0, g.sv * 0.8)
    }
    const star = union(spoke(90), spoke(30), spoke(-30))
    return move(star, r, g.H - r)
  }, 'open'),
  '+': spec((g) => {
    const yc = g.X * 0.55
    // Keep the vertical stroke inside the font's metrics when the x-height is small.
    const room = 2 * Math.min(yc - g.D + g.o - 4, g.A + g.o - yc - 4)
    const l = Math.max(g.sv * 2, Math.min(g.W(400), room))
    return union(g.bar(yc, 0, l), g.stem((l - g.sv) / 2, yc - l / 2, yc + l / 2))
  }, 'open'),
  ',': spec(comma, 'open'),
  '-': spec((g) => g.bar(g.X * 0.55, 0, g.W(300)), 'open'),
  '.': spec((g) => {
    const d = dotSize(g)
    return g.dot(d / 2, d / 2, d)
  }, 'open'),
  '/': spec((g) => {
    const { H, D } = g
    const w = g.W(430)
    return g.band(g.diag([w, H], [0, D * 0.25], H * 0.1), D * 0.25, H)
  }, 'diagonal'),
  ':': spec((g) => {
    const d = dotSize(g)
    return union(g.dot(d / 2, d / 2, d), g.dot(d / 2, g.X - d / 2, d))
  }, 'open'),
  ';': spec((g) => {
    const d = dotSize(g)
    return union(comma(g), g.dot(d / 2, g.X - d / 2, d))
  }, 'open'),
  '<': spec((g) => {
    const w = g.W(420)
    const yc = g.X * 0.55
    const dy = g.X * 0.36
    const e = g.sv
    return g.vband(union(g.diag([w, yc + dy], [0, yc], 0, e), g.diag([w, yc - dy], [0, yc], 0, e)), 0, w)
  }, 'diagonal'),
  '=': spec((g) => {
    const w = g.W(400)
    const yc = g.X * 0.55
    const gap = g.sh * 1.2
    return union(g.bar(yc + gap, 0, w), g.bar(yc - gap, 0, w))
  }, 'open'),
  '>': spec((g) => {
    const w = g.W(420)
    const yc = g.X * 0.55
    const dy = g.X * 0.36
    const e = g.sv
    return g.vband(union(g.diag([0, yc + dy], [w, yc], 0, e), g.diag([0, yc - dy], [w, yc], 0, e)), 0, w)
  }, 'diagonal'),
  '?': spec((g) => {
    const { H, o, sv, sh } = g
    const w = g.W(500)
    const ym = H * 0.6
    const d = dotSize(g)
    const archShape = g.ring(0, ym, w, H + o, { open: ['bottom'] })
    const hook = g.gap(archShape, 'left', w / 2, -4000, ym + (H + o - ym) * 0.32, { hi: true, lo: false })
    const cx = w / 2
    return union(hook, g.bar(ym, cx - sv / 2, w), g.stem(cx - sv / 2, H * 0.3, ym + sh / 2), g.dot(cx, d / 2, d))
  }, 'round'),
  '[': spec((g) => {
    const w = g.W(220)
    const { A, D } = g
    return union(g.stem(0, D * 0.75, A), g.barTop(A, 0, w), g.barBottom(D * 0.75, 0, w))
  }, 'straight', 'open'),
  '\\': spec((g) => {
    const { H, D } = g
    const w = g.W(430)
    return g.band(g.diag([0, H], [w, D * 0.25], H * 0.1), D * 0.25, H)
  }, 'diagonal'),
  ']': spec((g) => {
    const w = g.W(220)
    const { A, D } = g
    return union(g.stemR(w, D * 0.75, A), g.barTop(A, 0, w), g.barBottom(D * 0.75, 0, w))
  }, 'open', 'straight'),
  '^': spec((g) => {
    const { H } = g
    const w = g.W(420)
    const base = H * 0.55
    const e = g.sv
    return g.band(g.vband(union(g.diag([0, base], [w / 2, H], 0, e), g.diag([w, base], [w / 2, H], 0, e)), 0, w), base - g.sv, H)
  }, 'diagonal'),
  _: spec((g) => g.barBottom(g.D * 0.45, 0, g.W(560)), 'open'),
  '`': spec((g) => {
    const { H } = g
    const w = g.sv * 1.5
    return g.band(g.diag([0, H], [w, H - w * 0.9], g.sv * 0.3, 0), H - w, H)
  }, 'open'),
  '|': spec((g) => g.stem(0, g.D * 0.75, g.A)),
}

