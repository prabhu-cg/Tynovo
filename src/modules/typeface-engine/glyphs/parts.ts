import type { Geo } from '../geo'
import { inter, rect, union, type Shape } from '../geometry/shapes'

/**
 * An S built from two stacked bowls. The upper bowl loses its lower-right quadrant and the lower bowl its
 * upper-left quadrant, so the spine runs through the centre and the two terminals follow the terminal style.
 * `y0..y1` is the vertical extent including overshoot; `ap` is the aperture height.
 */
export function sCurve(g: Geo, w: number, y0: number, y1: number, ap: number): Shape {
  const ym = (y0 + y1) / 2
  const topBox = { x0: w * 0.03, x1: w * 0.97, y0: ym - g.sh / 2, y1 }
  const botBox = { x0: 0, x1: w, y0, y1: ym + g.sh / 2 }
  const top = g.ring(topBox.x0, topBox.y0, topBox.x1, topBox.y1)
  const bottom = g.ring(botBox.x0, botBox.y0, botBox.x1, botBox.y1)
  const cyTop = (topBox.y0 + topBox.y1) / 2
  const cyBot = (botBox.y0 + botBox.y1) / 2
  // Where each terminal ends: nudged by the aperture so a larger aperture gives a shorter hook.
  // Clamped so the terminals (and their round caps) always stay inside the bowls.
  const reach = Math.max(0, (y1 - cyTop) - g.sh * 1.6 - g.sv / 2)
  const lift = Math.max(-reach, Math.min(reach, (ap - 0.3 * (y1 - y0)) * 0.5))
  const termTop = cyTop + lift
  const termBot = cyBot - lift
  const t = g.gap(top, 'right', w / 2, -4000, termTop, { hi: true, lo: false })
  const b = g.gap(bottom, 'left', w / 2, termBot, 4000, { lo: true, hi: false })
  return union(t, b)
}

/** Bowl whose left edge is the stem (D shape). */
export const dBowl = (g: Geo, x0: number, y0: number, x1: number, y1: number) =>
  g.ring(x0, y0, x1, y1, { round: { tr: true, br: true, tl: false, bl: false } })

/** Arch: open at the bottom (n, h, m, r). */
export const arch = (g: Geo, x0: number, y0: number, x1: number, y1: number) => g.ring(x0, y0, x1, y1, { open: ['bottom'] })

/** Cup: open at the top (u, J, g tail). */
export const cup = (g: Geo, x0: number, y0: number, x1: number, y1: number) => g.ring(x0, y0, x1, y1, { open: ['top'] })

/** Remove everything of `s` that lies right of x (used to trim a leg off an arch). */
export const trimRightOf = (s: Shape, x: number, belowY: number): Shape => {
  const keep = rect(-4000, -4000, x, 4000)
  const top = rect(x, belowY, 4000, 4000)
  return union(inter(s, keep), inter(s, top))
}

export const dotSize = (g: Geo) => Math.round(g.sv * 1.15)

/**
 * Dot above the stem of i and j. Normally floats a little above the x-height; when the x-height is high or
 * the stroke heavy it is squeezed (gap first, then size) so it never rises above the ascender line.
 */
export const stemDot = (g: Geo): { size: number; cy: number } => {
  const limit = g.A + g.o
  let size = dotSize(g)
  let gap = Math.round(g.sv * 0.6)
  if (g.X + gap + size > limit) gap = Math.max(Math.round(g.sv * 0.2), limit - g.X - size)
  if (g.X + gap + size > limit) size = Math.max(Math.round(g.sv * 0.5), limit - g.X - gap)
  // Last resort when the x-height almost reaches the ascender: let the dot touch the stem rather than leave the metrics.
  const cy = Math.min(g.X + gap + size / 2, limit - size / 2)
  return { size, cy }
}
