import { z } from 'zod'
import { CORNER_STYLES, FAMILIES, TERMINALS, TONES, USE_CASES, type Dna, type Tone, type UseCase } from '../brand-projects/schema'
import { DNA_CONTROLS } from '../typeface-engine/dna'

/**
 * What goes between the page, the server function and the model. Shared by both ends, pure (zod only), so the page
 * and the function agree on the shapes, and neither trusts the other: the model's answer is parsed and clamped by
 * the function, and parsed and clamped again by the page before it can touch a project.
 */
export const AI_TASKS = ['brand', 'typeface'] as const
export type AiTask = (typeof AI_TASKS)[number]

/** Most characters a brief may have. The function refuses more; the page stops typing there. */
export const MAX_BRIEF = 1200
export const MIN_BRIEF = 12

export const aiRequestSchema = z.object({
  task: z.enum(AI_TASKS),
  text: z.string().trim().min(MIN_BRIEF).max(MAX_BRIEF),
})
export type AiRequest = z.infer<typeof aiRequestSchema>

/* ---------- brand direction ---------- */

export interface BrandSuggestion {
  personality: string[]
  useCases: UseCase[]
  tones: Tone[]
  readabilityPriority: number
  displayPriority: number
  /** One or two sentences: why these choices fit the brief. */
  rationale: string
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const clampInt = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback)
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const oneOf = <T extends string>(values: readonly T[], list: unknown[]): T[] => [...new Set(list.filter((x): x is T => typeof x === 'string' && (values as readonly string[]).includes(x.toLowerCase())).map((x) => x.toLowerCase() as T))]

/** The model's JSON as a brand suggestion, with anything outside the allowed values dropped. Null when nothing usable is left. */
export function sanitizeBrand(raw: unknown): BrandSuggestion | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const personality = [...new Set(asArray(r['personality']).map((p) => text(p, 40)).filter(Boolean))].slice(0, 6)
  const useCases = oneOf(USE_CASES, asArray(r['useCases']))
  const tones = oneOf(TONES, asArray(r['tones']))
  if (personality.length === 0 && useCases.length === 0 && tones.length === 0) return null
  return {
    personality,
    useCases,
    tones,
    readabilityPriority: clampInt(r['readabilityPriority'], 1, 5, 3),
    displayPriority: clampInt(r['displayPriority'], 1, 5, 3),
    rationale: text(r['rationale'], 400),
  }
}

/* ---------- typeface design ---------- */

/** The parameters a description may set. Anything else the model invents is ignored. */
export const SUGGESTED_KEYS = ['strokeThickness', 'contrast', 'widthScale', 'roundness', 'cornerRadius', 'aperture', 'xHeightRatio', 'tracking', 'sidebearing'] as const satisfies readonly (keyof Dna)[]

export interface TypefaceSuggestion {
  family?: Dna['family']
  cornerStyle?: Dna['cornerStyle']
  terminal?: Dna['terminal']
  /** Numeric parameters, each clamped to its control's range and snapped to its step. */
  values: Partial<Pick<Dna, (typeof SUGGESTED_KEYS)[number]>>
  rationale: string
}

const snap = (v: number, min: number, max: number, step: number) => {
  const clamped = Math.min(max, Math.max(min, v))
  const snapped = Math.round((clamped - min) / step) * step + min
  return Number(Math.min(max, snapped).toFixed(step < 1 ? 2 : 0))
}

/**
 * A typeface suggestion from the model (flat keys) or from the function (the same, with the numbers under `values`):
 * both are read, so a suggestion that has already been cleaned is cleaned to itself.
 */
export function sanitizeTypeface(raw: unknown): TypefaceSuggestion | null {
  if (typeof raw !== 'object' || raw === null) return null
  const top = raw as Record<string, unknown>
  const nested = typeof top['values'] === 'object' && top['values'] !== null && !Array.isArray(top['values']) ? (top['values'] as Record<string, unknown>) : {}
  const r: Record<string, unknown> = { ...top, ...nested }
  const out: TypefaceSuggestion = { values: {}, rationale: text(r['rationale'], 400) }
  const pick = <T extends string>(values: readonly T[], v: unknown): T | undefined => (typeof v === 'string' && (values as readonly string[]).includes(v.toLowerCase()) ? (v.toLowerCase() as T) : undefined)
  const family = pick(FAMILIES, r['family'])
  const cornerStyle = pick(CORNER_STYLES, r['cornerStyle'])
  const terminal = pick(TERMINALS, r['terminal'])
  if (family) out.family = family
  if (cornerStyle) out.cornerStyle = cornerStyle
  if (terminal) out.terminal = terminal
  for (const key of SUGGESTED_KEYS) {
    const control = DNA_CONTROLS.find((c) => c.key === key)!
    const v = r[key]
    if (typeof v === 'number' && Number.isFinite(v)) out.values[key] = snap(v, control.min, control.max, control.step)
  }
  const any = out.family || out.cornerStyle || out.terminal || Object.keys(out.values).length > 0
  return any ? out : null
}

/* ---------- the function's answer ---------- */

export type AiError = 'bad-request' | 'forbidden' | 'rate-limited' | 'unavailable' | 'bad-answer' | 'timeout'
export type AiResponse =
  | { ok: true; task: 'brand'; data: BrandSuggestion }
  | { ok: true; task: 'typeface'; data: TypefaceSuggestion }
  | { ok: false; error: AiError; message: string }
