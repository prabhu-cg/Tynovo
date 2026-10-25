import type { Dna, Variant } from '../brand-projects/schema'
import { DNA_CONTROLS } from './dna'

/**
 * Controlled variation. Random choices come from a seeded generator, never from Math.random, so
 * (base design, seed, index, spread) always yields the same variant, and the stored `origin` can reproduce it.
 */
export interface VariantOrigin {
  seed: number
  index: number
  spread: number
}

/** mulberry32: small, fast, deterministic. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Mix a seed and an index into a new seed so variants of one batch are independent. */
const mix = (seed: number, index: number) => (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(index + 1, 0xc2b2ae35)) >>> 0

/** Parameters that vary, and how strongly (1 = full spread). Family, grid and vertical metrics stay fixed. */
const AXES: Array<{ key: keyof Dna; weight: number }> = [
  { key: 'strokeThickness', weight: 1 },
  { key: 'contrast', weight: 0.8 },
  { key: 'widthScale', weight: 0.8 },
  { key: 'roundness', weight: 0.7 },
  { key: 'cornerRadius', weight: 0.8 },
  { key: 'xHeightRatio', weight: 0.4 },
  { key: 'aperture', weight: 0.6 },
  { key: 'crossbarPosition', weight: 0.5 },
  { key: 'sidebearing', weight: 0.6 },
  { key: 'tracking', weight: 0.4 },
]

/** One variant of `base`. `spread` is 0..1: the largest move, as a share of each control's range. */
export function deriveVariant(base: Dna, origin: VariantOrigin): Dna {
  const rnd = rng(mix(origin.seed, origin.index))
  const next: Record<string, unknown> = { ...base }
  for (const axis of AXES) {
    const control = DNA_CONTROLS.find((c) => c.key === axis.key)
    if (!control) continue
    const current = base[axis.key] as number
    const delta = (rnd() * 2 - 1) * origin.spread * axis.weight * 0.5 * (control.max - control.min)
    let v = current + delta
    v = Math.round(v / control.step) * control.step
    v = Math.min(control.max, Math.max(control.min, +v.toFixed(4)))
    next[axis.key] = v
  }
  // Rarely change the terminal style (never when spread is tiny).
  if (rnd() < origin.spread * 0.5) next['terminal'] = (['flat', 'angled', 'round'] as const)[Math.floor(rnd() * 3)]
  return next as Dna
}

export interface Candidate {
  dna: Dna
  origin: VariantOrigin
}

export function exploreVariants(base: Dna, seed: number, count: number, spread: number): Candidate[] {
  const out: Candidate[] = []
  for (let index = 0; index < count; index++) {
    const origin = { seed, index, spread }
    out.push({ dna: deriveVariant(base, origin), origin })
  }
  return out
}

export const isReproducible = (base: Dna, v: Variant): boolean =>
  v.origin !== null && JSON.stringify(deriveVariant(base, v.origin)) === JSON.stringify(v.dna)

/** A short readable list of what differs between two designs, for comparing variants. */
export function describeDifference(from: Dna, to: Dna): string[] {
  const out: string[] = []
  for (const c of DNA_CONTROLS) {
    const a = from[c.key] as number
    const b = to[c.key] as number
    if (a !== b) out.push(`${c.label} ${a} → ${b}`)
  }
  if (from.terminal !== to.terminal) out.push(`Terminals ${from.terminal} → ${to.terminal}`)
  if (from.cornerStyle !== to.cornerStyle) out.push(`Corners ${from.cornerStyle} → ${to.cornerStyle}`)
  if (from.family !== to.family) out.push(`Family ${from.family} → ${to.family}`)
  return out
}
