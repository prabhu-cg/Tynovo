import { diff, rect, rotate180, union, type Shape } from '../geometry/shapes'
import { spec, type SpecTable } from './types'
import type { Geo } from '../geo'

/** 6 is built once; 9 is the same glyph turned half way round, so the two always match. */
const six = (g: Geo): Shape => {
  const { H, o } = g
  const w = g.W(540)
  const bowlTop = Math.round(H * 0.64)
  const bowl = g.ring(0, -o, w, bowlTop)
  // One tall arch: its left leg runs down into the bowl, its right leg is cut short to leave the terminal.
  const archW = Math.round(w * 0.88)
  const arcH = H + o - bowlTop / 2
  const arch = g.ring(0, bowlTop / 2, archW, H + o, { open: ['bottom'] })
  const hook = g.gap(arch, 'right', archW / 2, -4000, H + o - arcH * 0.38, { hi: true, lo: false })
  return union(bowl, hook)
}

export const digits: SpecTable = {
  '0': spec((g) => g.ring(0, -g.o, g.W(540), g.H + g.o), 'round'),
  '1': spec((g) => {
    const { H } = g
    const sx = g.W(170)
    const flag = g.vband(g.band(g.diag([sx + g.sv * 0.4, H], [0, H * 0.8], g.sv, 0), 0, H), 0, sx + g.sv)
    return union(g.stem(sx, 0, H), flag)
  }, 'open', 'straight'),
  '2': spec((g) => {
    const { H, o, sv } = g
    const w = g.W(540)
    const ym = H * 0.58
    const top = g.ring(0, ym, w, H + o, { open: ['bottom'] })
    const hook = g.gap(top, 'left', w / 2, -4000, ym + (H + o - ym) * 0.32, { hi: true, lo: false })
    const diagonal = g.vband(g.band(g.diag([w - sv * 0.5, ym + sv * 0.8], [sv * 0.45, 0], 0, g.H * 0.2), 0, H), 0, w)
    return union(hook, diagonal, g.barBottom(0, 0, w))
  }, 'round', 'straight'),
  '3': spec((g) => {
    const { H, o, sh } = g
    const w = g.W(520)
    const ym = H * 0.54
    const top = g.ring(0, ym - sh / 2, w * 0.9, H + o, { open: ['left'] })
    const bottom = g.ring(0, -o, w, ym + sh / 2, { open: ['left'] })
    const both = union(top, bottom)
    return diff(both, rect(-4000, ym - sh / 2 - 1, w * 0.3, ym + sh / 2 + 1))
  }, 'open', 'round'),
  '4': spec((g) => {
    const { H, sv } = g
    const w = g.W(580)
    const xs = Math.round(w * 0.66)
    const yb = Math.round(H * 0.3)
    const d = g.band(g.diag([xs + sv * 0.5, H], [sv * 0.25, yb], g.H * 0.2, 0), 0, H)
    return union(g.stem(xs, 0, H), g.vband(d, 0, w), g.bar(yb, 0, w))
  }, 'diagonal', 'straight'),
  '5': spec((g) => {
    const { H, o, sh } = g
    const w = g.W(520)
    const yt = Math.round(H * 0.6)
    const bowl = g.ring(0, -o, w, yt, { open: ['left'] })
    return union(g.barTop(H, 0, w * 0.95), g.stem(0, yt - sh, H), bowl)
  }, 'straight', 'round'),
  '6': spec(six, 'round'),
  '7': spec((g) => {
    const { H, sv } = g
    const w = g.W(520)
    const d = g.band(g.diag([w - sv * 0.35, H], [w * 0.3, 0], g.H * 0.2), 0, H)
    return union(g.barTop(H, 0, w), d)
  }, 'open', 'diagonal'),
  '8': spec((g) => {
    const { H, o, sh } = g
    const w = g.W(520)
    const ym = H * 0.54
    return union(g.ring(w * 0.07, ym - sh / 2, w * 0.93, H + o), g.ring(0, -o, w, ym + sh / 2))
  }, 'round'),
  '9': spec((g) => {
    const s = six(g)
    return rotate180(s, g.W(540) / 2, g.H / 2)
  }, 'round'),
}

