/**
 * View transform for the outline canvas. Pure maths, no DOM.
 * A view is a centre in font units (y up) and a scale in font units per CSS pixel; screen positions are CSS
 * pixels from the canvas’s top-left corner.
 */
export interface View {
  cx: number
  cy: number
  /** Font units per CSS pixel. Smaller means zoomed in. */
  upp: number
}

export interface Size {
  w: number
  h: number
}

export interface Box {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export const MIN_UPP = 0.04
export const MAX_UPP = 16

const clampUpp = (u: number) => Math.min(MAX_UPP, Math.max(MIN_UPP, u))

export function toWorld(v: View, s: Size, px: number, py: number): { x: number; y: number } {
  return { x: v.cx + (px - s.w / 2) * v.upp, y: v.cy - (py - s.h / 2) * v.upp }
}

export function toScreen(v: View, s: Size, x: number, y: number): { px: number; py: number } {
  return { px: (x - v.cx) / v.upp + s.w / 2, py: (v.cy - y) / v.upp + s.h / 2 }
}

/** Show `box` entirely, centred, with `padPx` of air around it. */
export function fitView(s: Size, box: Box, padPx = 40): View {
  const availW = Math.max(40, s.w - padPx * 2)
  const availH = Math.max(40, s.h - padPx * 2)
  const upp = clampUpp(Math.max((box.maxX - box.minX) / availW, (box.maxY - box.minY) / availH))
  return { cx: (box.minX + box.maxX) / 2, cy: (box.minY + box.maxY) / 2, upp }
}

/** Zoom by `factor` (> 1 zooms in) keeping the world point under (px, py) where it is. */
export function zoomAt(v: View, s: Size, factor: number, px: number, py: number): View {
  const anchor = toWorld(v, s, px, py)
  const upp = clampUpp(v.upp / factor)
  return { upp, cx: anchor.x - (px - s.w / 2) * upp, cy: anchor.y + (py - s.h / 2) * upp }
}

export function panBy(v: View, dxPx: number, dyPx: number): View {
  return { ...v, cx: v.cx - dxPx * v.upp, cy: v.cy + dyPx * v.upp }
}

/** SVG viewBox for a canvas drawn with a y-flipped group (screen y = −world y). */
export function viewBox(v: View, s: Size): string {
  const w = s.w * v.upp
  const h = s.h * v.upp
  return `${v.cx - w / 2} ${-v.cy - h / 2} ${w} ${h}`
}

/** 100% means one font unit per CSS pixel. */
export const zoomPercent = (v: View) => Math.round(100 / v.upp)
