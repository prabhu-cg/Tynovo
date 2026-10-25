import type { Geo } from '../geo'
import { inter, union, type Pt } from '../geometry/shapes'
import { arch, cup, sCurve, stemDot, trimRightOf } from './parts'
import { spec, type SpecTable } from './types'

const foot = (g: Geo) => g.sv * 0.58
/** Terminal opening of lower-case round letters. */
const apX = (g: Geo) => g.dna.aperture * g.X * 1.05
const bowl = (g: Geo, w: number) => g.ring(0, -g.o, w, g.X + g.o)

/** Descender tail shared by g and j: a cup under the baseline whose left arm stops short. */
const tail = (g: Geo, x0: number, x1: number) => {
  const top = -Math.round(g.sh * 0.2)
  return g.band(cup(g, x0, g.D, x1, top), g.D - 1, g.D * 0.28)
}

export const lower: SpecTable = {
  a: spec((g) => {
    const w = g.W(520)
    return union(bowl(g, w), g.stemR(w, 0, g.X))
  }, 'round', 'straight'),
  b: spec((g) => {
    const w = g.W(540)
    return union(g.stem(0, 0, g.A), bowl(g, w))
  }, 'straight', 'round'),
  c: spec(
    (g) => {
      const w = g.W(520)
      const ap = apX(g)
      return g.gap(bowl(g, w), 'right', w / 2, g.X / 2 - ap / 2, g.X / 2 + ap / 2)
    },
    'round',
    'open',
  ),
  d: spec((g) => {
    const w = g.W(540)
    return union(g.stemR(w, 0, g.A), bowl(g, w))
  }, 'round', 'straight'),
  e: spec(
    (g) => {
      const w = g.W(540)
      const { X, o } = g
      const yBar = X * g.dna.crossbarPosition
      const barBottom = yBar - g.sh / 2
      const ap = apX(g)
      const shell = g.gap(bowl(g, w), 'right', w / 2, barBottom - ap * 0.75, barBottom, { lo: true, hi: false })
      const bar = inter(g.bar(yBar, -1, w + 1), g.box(0, -o, w, X + o))
      return union(shell, bar)
    },
    'round',
    'open',
  ),
  f: spec(
    (g) => {
      const { X, A, sv } = g
      const bw = g.W(330)
      const sx = g.W(110)
      const hw = g.W(250)
      const hookH = Math.round(hw * 0.9)
      const hook = trimRightOf(arch(g, sx, A - hookH, sx + hw, A), sx + sv, A - hookH * 0.5)
      return union(g.stem(sx, 0, A - hookH * 0.6), hook, g.barTop(X, 0, bw))
    },
    'open',
    'open',
  ),
  g: spec(
    (g) => {
      const w = g.W(520)
      return union(bowl(g, w), g.stemR(w, g.D * 0.35, g.X), tail(g, 0, w))
    },
    'round',
    'straight',
  ),
  h: spec((g) => {
    const w = g.W(500)
    return union(g.stem(0, 0, g.A), arch(g, 0, 0, w, g.X + g.o))
  }),
  i: spec((g) => {
    const { size, cy } = stemDot(g)
    const wide = Math.max(size, g.sv)
    return union(g.stem((wide - g.sv) / 2, 0, g.X), g.dot(wide / 2, cy, size))
  }),
  j: spec((g) => {
    const { size, cy } = stemDot(g)
    const sx = g.W(240)
    return union(g.stem(sx, g.D * 0.35, g.X), tail(g, 0, sx + g.sv), g.dot(sx + g.sv / 2, cy, size))
  }, 'open', 'straight'),
  k: spec(
    (g) => {
      const { X } = g
      const w = g.W(480)
      const f = foot(g)
      const j: Pt = [g.sv * 0.5, X * 0.38]
      const e = X * 0.2
      const arms = union(g.diag([w - f, X], j, e, 0), g.diag([w - f, 0], j, e, 0))
      return union(g.stem(0, 0, g.A), g.vband(g.band(arms, 0, X), 0, w))
    },
    'straight',
    'diagonal',
  ),
  l: spec((g) => g.stem(0, 0, g.A)),
  m: spec((g) => {
    const w1 = g.W(420)
    return union(g.stem(0, 0, g.X), arch(g, 0, 0, w1, g.X + g.o), arch(g, w1 - g.sv, 0, 2 * w1 - g.sv, g.X + g.o))
  }),
  n: spec((g) => {
    const w = g.W(500)
    return union(g.stem(0, 0, g.X), arch(g, 0, 0, w, g.X + g.o))
  }),
  o: spec((g) => bowl(g, g.W(560)), 'round'),
  p: spec((g) => {
    const w = g.W(540)
    return union(g.stem(0, g.D, g.X), bowl(g, w))
  }, 'straight', 'round'),
  q: spec((g) => {
    const w = g.W(540)
    return union(g.stemR(w, g.D, g.X), bowl(g, w))
  }, 'round', 'straight'),
  r: spec(
    (g) => {
      const w = g.W(380)
      const shoulder = trimRightOf(arch(g, 0, 0, w, g.X + g.o), g.sv, g.X * 0.46)
      return union(g.stem(0, 0, g.X), shoulder)
    },
    'straight',
    'open',
  ),
  s: spec((g) => sCurve(g, g.W(460), -g.o, g.X + g.o, apX(g) * 0.95), 'round'),
  t: spec(
    (g) => {
      const bw = g.W(340)
      const top = g.X + Math.round((g.A - g.X) * 0.5)
      return union(g.stem((bw - g.sv) / 2, 0, top), g.barTop(g.X, 0, bw))
    },
    'open',
    'open',
  ),
  u: spec((g) => {
    const w = g.W(500)
    return union(cup(g, 0, -g.o, w, g.X), g.stemR(w, 0, g.X))
  }),
  v: spec(
    (g) => {
      const { X } = g
      const w = g.W(520)
      const f = foot(g)
      const e = X * 0.25
      return g.band(union(g.diag([f, X], [w / 2, 0], e), g.diag([w - f, X], [w / 2, 0], e)), 0, X)
    },
    'diagonal',
  ),
  w: spec(
    (g) => {
      const { X } = g
      const w = g.W(780)
      const f = foot(g)
      const e = X * 0.25
      const q = (w - 2 * f) / 4
      return g.band(
        union(
          g.diag([f, X], [f + q, 0], e),
          g.diag([f + 2 * q, X], [f + q, 0], e),
          g.diag([f + 2 * q, X], [f + 3 * q, 0], e),
          g.diag([w - f, X], [f + 3 * q, 0], e),
        ),
        0,
        X,
      )
    },
    'diagonal',
  ),
  x: spec(
    (g) => {
      const { X } = g
      const w = g.W(540)
      const f = foot(g)
      const e = X * 0.2
      return g.band(union(g.diag([f, X], [w - f, 0], e), g.diag([w - f, X], [f, 0], e)), 0, X)
    },
    'diagonal',
  ),
  y: spec(
    (g) => {
      const { X, D } = g
      const w = g.W(520)
      const f = foot(g)
      const right: [Pt, Pt] = [[w - f, X], [w * 0.28, D]]
      // The left arm meets the long arm near the baseline.
      const t = (X - g.sh * 0.6) / (X - D)
      const join: Pt = [right[0][0] + (right[1][0] - right[0][0]) * t, X - (X - D) * t]
      const e = X * 0.2
      const longArm = g.diag(right[0], right[1], e, 0)
      const leftArm = g.diag([f, X], join, e, 0)
      return g.band(union(longArm, leftArm), D, X)
    },
    'diagonal',
  ),
  z: spec(
    (g) => {
      const { X, sv } = g
      const w = g.W(480)
      const d = g.diag([w - sv * 0.45, X], [sv * 0.45, 0], X * 0.2)
      return union(g.barTop(X, 0, w), g.barBottom(0, 0, w), g.band(d, 0, X))
    },
    'open',
  ),
}

