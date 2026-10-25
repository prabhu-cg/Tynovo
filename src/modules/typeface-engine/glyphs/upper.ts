import type { Geo } from '../geo'
import { union, type Pt, type Shape } from '../geometry/shapes'
import { sCurve } from './parts'
import { spec, type SpecTable } from './types'

/** Horizontal distance from the outer edge to the centre line of a diagonal leg at its foot. */
const foot = (g: Geo) => g.sv * 0.58

/** Bowl-and-stem helper: a D-shaped ring whose left side is the stem. */
const dRing = (g: Geo, x0: number, y0: number, x1: number, y1: number) => g.ring(x0, y0, x1, y1, { round: { tr: true, br: true, tl: false, bl: false } })

/** Terminal opening of the round letters, as a height. */
const apertureH = (g: Geo) => g.dna.aperture * g.H

export const upper: SpecTable = {
  A: spec(
    (g) => {
      const { H } = g
      const w = g.W(700)
      const f = foot(g)
      const e = H * 0.25
      const legs = union(g.diag([f, 0], [w / 2, H], e), g.diag([w - f, 0], [w / 2, H], e))
      const barY = H * (g.dna.crossbarPosition - 0.17)
      const xl = f + ((w / 2 - f) * barY) / H
      return g.band(union(legs, g.bar(barY, xl, w - xl)), 0, H)
    },
    'diagonal',
  ),
  B: spec((g) => {
    const { H } = g
    const w = g.W(560)
    const yb = H * 0.54 // the shared middle bar
    const upper = dRing(g, 0, yb - g.sh / 2, w * 0.92, H)
    const lower = dRing(g, 0, 0, w, yb + g.sh / 2)
    return union(g.stem(0, 0, H), upper, lower)
  }, 'straight', 'round'),
  C: spec(
    (g) => {
      const { H, o } = g
      const w = g.W(660)
      const ap = apertureH(g)
      return g.gap(g.ring(0, -o, w, H + o), 'right', w / 2, H / 2 - ap / 2, H / 2 + ap / 2)
    },
    'round',
    'open',
  ),
  D: spec((g) => dRing(g, 0, 0, g.W(620), g.H), 'straight', 'round'),
  E: spec((g) => {
    const { H } = g
    const w = g.W(480)
    return union(g.stem(0, 0, H), g.barTop(H, 0, w), g.bar(H * g.dna.crossbarPosition, 0, w * 0.86), g.barBottom(0, 0, w))
  }, 'straight', 'open'),
  F: spec((g) => {
    const { H } = g
    const w = g.W(460)
    return union(g.stem(0, 0, H), g.barTop(H, 0, w), g.bar(H * g.dna.crossbarPosition, 0, w * 0.86))
  }, 'straight', 'open'),
  G: spec(
    (g) => {
      const { H, o } = g
      const w = g.W(680)
      const ap = apertureH(g)
      const yBar = H * 0.48
      const lo = yBar + g.sh / 2
      // The upper terminal (plus any round cap) must stay below the top of the bowl.
      const hi = Math.min(lo + ap * 0.7, H + o - g.sh * 1.6 - g.sv / 2)
      const open = g.gap(g.ring(0, -o, w, H + o), 'right', w / 2, lo, Math.max(hi, lo + g.sh * 0.5), { hi: true, lo: false })
      return union(open, g.bar(yBar, w * 0.5, w))
    },
    'round',
    'straight',
  ),
  H: spec((g) => {
    const { H } = g
    const w = g.W(580)
    return union(g.stem(0, 0, H), g.stemR(w, 0, H), g.bar(H * g.dna.crossbarPosition, 0, w))
  }),
  I: spec((g) => g.stem(0, 0, g.H)),
  J: spec(
    (g) => {
      const { H, o } = g
      const w = g.W(430)
      const cup = g.ring(0, -o, w, H * 0.58, { open: ['top'] })
      return union(g.band(cup, -o - 1, H * 0.36), g.stemR(w, H * 0.3, H))
    },
    'open',
    'straight',
  ),
  K: spec(
    (g) => {
      const { H } = g
      const w = g.W(560)
      const f = foot(g)
      const yj = H * 0.42
      const j: Pt = [g.sv * 0.5, yj]
      const e = H * 0.2
      const arms = union(g.diag([w - f, H], j, e, 0), g.diag([w - f, 0], j, e, 0))
      return union(g.stem(0, 0, H), g.vband(g.band(arms, 0, H), 0, w))
    },
    'straight',
    'diagonal',
  ),
  L: spec((g) => union(g.stem(0, 0, g.H), g.barBottom(0, 0, g.W(440))), 'straight', 'open'),
  M: spec(
    (g) => {
      const { H, sv } = g
      const w = g.W(780)
      const e = H * 0.25
      const diags = union(g.diag([sv * 0.5, H], [w / 2, 0], e), g.diag([w - sv * 0.5, H], [w / 2, 0], e))
      return union(g.stem(0, 0, H), g.stemR(w, 0, H), g.band(diags, 0, H))
    },
  ),
  N: spec((g) => {
    const { H, sv } = g
    const w = g.W(620)
    const e = H * 0.25
    return union(g.stem(0, 0, H), g.stemR(w, 0, H), g.band(g.diag([sv * 0.5, H], [w - sv * 0.5, 0], e), 0, H))
  }),
  O: spec((g) => g.ring(0, -g.o, g.W(700), g.H + g.o), 'round'),
  P: spec((g) => {
    const { H } = g
    const w = g.W(540)
    return union(g.stem(0, 0, H), dRing(g, 0, H * 0.42, w, H))
  }, 'straight', 'round'),
  Q: spec(
    (g) => {
      const { H, o } = g
      const w = g.W(700)
      const tail = g.diag([w * 0.56, H * 0.3], [w * 0.94, -H * 0.08], 0, g.sv * 0.4)
      return union(g.ring(0, -o, w, H + o), g.band(tail, g.D * 0.6, H))
    },
    'round',
  ),
  R: spec(
    (g) => {
      const { H } = g
      const w = g.W(560)
      const f = foot(g)
      const yb = H * 0.42
      const leg = g.diag([w * 0.42, yb], [w - f, 0], g.sh, g.H * 0.2)
      return union(g.stem(0, 0, H), dRing(g, 0, yb, w * 0.96, H), g.band(leg, 0, H))
    },
    'straight',
    'diagonal',
  ),
  S: spec((g) => sCurve(g, g.W(540), -g.o, g.H + g.o, apertureH(g)), 'round'),
  T: spec(
    (g) => {
      const { H } = g
      const w = g.W(600)
      return union(g.barTop(H, 0, w), g.stem((w - g.sv) / 2, 0, H))
    },
    'open',
  ),
  U: spec((g) => g.ring(0, -g.o, g.W(590), g.H, { open: ['top'] }), 'straight'),
  V: spec(
    (g) => {
      const { H } = g
      const w = g.W(660)
      const f = foot(g)
      const e = H * 0.25
      return g.band(union(g.diag([f, H], [w / 2, 0], e), g.diag([w - f, H], [w / 2, 0], e)), 0, H)
    },
    'diagonal',
  ),
  W: spec(
    (g) => {
      const { H } = g
      const w = g.W(960)
      const f = foot(g)
      const e = H * 0.25
      const q = (w - 2 * f) / 4
      return g.band(
        union(
          g.diag([f, H], [f + q, 0], e),
          g.diag([f + 2 * q, H], [f + q, 0], e),
          g.diag([f + 2 * q, H], [f + 3 * q, 0], e),
          g.diag([w - f, H], [f + 3 * q, 0], e),
        ),
        0,
        H,
      )
    },
    'diagonal',
  ),
  X: spec(
    (g) => {
      const { H } = g
      const w = g.W(650)
      const f = foot(g)
      const e = H * 0.2
      return g.band(union(g.diag([f, H], [w - f, 0], e), g.diag([w - f, H], [f, 0], e)), 0, H)
    },
    'diagonal',
  ),
  Y: spec(
    (g) => {
      const { H } = g
      const w = g.W(640)
      const f = foot(g)
      const yj = H * 0.42
      const e = H * 0.2
      const arms = union(g.diag([f, H], [w / 2, yj], e, 0), g.diag([w - f, H], [w / 2, yj], e, 0))
      return union(g.band(arms, 0, H), g.stem((w - g.sv) / 2, 0, yj + g.sh))
    },
    'diagonal',
  ),
  Z: spec(
    (g) => {
      const { H, sv } = g
      const w = g.W(580)
      const d = g.diag([w - sv * 0.45, H], [sv * 0.45, 0], g.H * 0.2)
      return union(g.barTop(H, 0, w), g.barBottom(0, 0, w), g.band(d, 0, H))
    },
    'open',
  ),
}

export type { Shape }
