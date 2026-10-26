import type { Responsive, TypeScale } from '@/modules/brand-projects/schema'

export interface ScaleStep {
  step: number
  sizePx: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Modular scale around `baseSizePx`: size(step) = base * ratio^step. Ordered smallest to largest. */
export function computeScale({ baseSizePx, ratio, stepsDown, stepsUp }: TypeScale): ScaleStep[] {
  const out: ScaleStep[] = []
  for (let step = 0 - stepsDown; step <= stepsUp; step++) {
    out.push({ step, sizePx: round2(baseSizePx * ratio ** step) })
  }
  return out
}

export function sizeForStep(scale: TypeScale, step: number): number {
  return round2(scale.baseSizePx * scale.ratio ** step)
}

/* ---------- fluid (responsive) sizes ---------- */

type Fluid = { scale: TypeScale; responsive: Responsive }

export interface SizeSpec {
  step: number
  /** Size at and below the small viewport. Equal to maxPx when responsive sizing is off. */
  minPx: number
  /** Size at and above the large viewport (the main scale). */
  maxPx: number
  fluid: boolean
}

/** Sizes of one scale step. The main scale gives the large size; the small scale (if enabled) gives the small one. */
export function sizeSpec({ scale, responsive }: Fluid, step: number): SizeSpec {
  const maxPx = sizeForStep(scale, step)
  if (!responsive.enabled) return { step, minPx: maxPx, maxPx, fluid: false }
  const minPx = round2(responsive.minBaseSizePx * responsive.minRatio ** step)
  return { step, minPx, maxPx, fluid: minPx !== maxPx }
}

/** Size in px at a viewport width, exactly as the exported CSS clamp() computes it. */
export function sizeAt(f: Fluid, step: number, viewportPx: number): number {
  const s = sizeSpec(f, step)
  if (!s.fluid) return s.maxPx
  const { minViewportPx: lo, maxViewportPx: hi } = f.responsive
  const t = Math.min(1, Math.max(0, (viewportPx - lo) / (hi - lo)))
  return Math.round((s.minPx + (s.maxPx - s.minPx) * t) * 100) / 100
}

const r4 = (n: number) => Number(n.toFixed(4))
export const toRem = (px: number) => `${r4(px / 16)}rem`

/** CSS value for a step's font size: a plain rem value, or clamp(min, preferred, max) when sizes are fluid. */
export function cssSize(f: Fluid, step: number): string {
  const s = sizeSpec(f, step)
  if (!s.fluid) return toRem(s.maxPx)
  const { minViewportPx: lo, maxViewportPx: hi } = f.responsive
  const slope = (s.maxPx - s.minPx) / (hi - lo)
  const intercept = s.minPx - slope * lo
  const [a, b] = s.minPx < s.maxPx ? [s.minPx, s.maxPx] : [s.maxPx, s.minPx]
  return `clamp(${toRem(a)}, ${r4(intercept / 16)}rem + ${r4(slope * 100)}vw, ${toRem(b)})`
}
