import type { TypeScale } from '@/modules/brand-projects/schema'

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
