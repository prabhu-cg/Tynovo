import type { CustomTypeface, Dna, GlyphOverride, GlyphParams, Snapshot, Variant } from '../brand-projects/schema'
import { defaultDna, type Family } from './dna'
import { generateGlyph } from './generate'

/**
 * Pure edit operations on a typeface. Every function returns a new typeface and leaves its input untouched.
 * Ids and timestamps are passed in, so the same inputs always give the same result.
 *
 * Rule that matters: global edits (dna, family) never touch `overrides`. Overrides only go away through
 * resetGlyph / resetAllOverrides, which are explicit user actions.
 */
export const HISTORY_LIMIT = 30
export const VARIANT_LIMIT = 60

export interface Stamp {
  id: string
  at: string
}

const sameDna = (a: Dna, b: Dna) => JSON.stringify(a) === JSON.stringify(b)

/* ---------- global design ---------- */

/** Replace the design DNA. Overrides are kept. */
export function setDna(face: CustomTypeface, dna: Dna): CustomTypeface {
  return sameDna(face.dna, dna) ? face : { ...face, dna }
}

/** Change one or more parameters. Overrides are kept. */
export function patchDna(face: CustomTypeface, patch: Partial<Dna>): CustomTypeface {
  return setDna(face, { ...face.dna, ...patch })
}

/** Remember the current design so it can be restored. Skips when it equals the latest restore point. */
export function checkpoint(face: CustomTypeface, label: string, stamp: Stamp): CustomTypeface {
  const last = face.history[0]
  if (last && sameDna(last.dna, face.dna)) return face
  const snap: Snapshot = { id: stamp.id, label: label.slice(0, 80), at: stamp.at, dna: face.dna }
  return { ...face, history: [snap, ...face.history].slice(0, HISTORY_LIMIT) }
}

/** Restore a restore point. The design being replaced is itself checkpointed first, so a restore can be undone. */
export function restoreSnapshot(face: CustomTypeface, snapshotId: string, stamp: Stamp): CustomTypeface {
  const snap = face.history.find((h) => h.id === snapshotId)
  if (!snap) return face
  const saved = checkpoint(face, 'Before restoring', stamp)
  return setDna(saved, snap.dna)
}

/** Switch family: starts from that family's defaults (current design is checkpointed). Overrides are kept. */
export function switchFamily(face: CustomTypeface, family: Family, stamp: Stamp): CustomTypeface {
  if (face.dna.family === family) return face
  return setDna(checkpoint(face, `Before switching to ${family}`, stamp), defaultDna(family))
}

/** Back to the family's defaults. Overrides are kept; use resetAllOverrides to clear those too. */
export function resetDna(face: CustomTypeface, stamp: Stamp): CustomTypeface {
  return setDna(checkpoint(face, 'Before reset', stamp), defaultDna(face.dna.family))
}

/* ---------- per-glyph overrides ---------- */

const isEmpty = (o: GlyphOverride) =>
  o.advanceWidth === undefined && o.leftBearing === undefined && o.rightBearing === undefined && o.contours === undefined && (!o.params || Object.keys(o.params).length === 0)

function withOverride(face: CustomTypeface, char: string, next: GlyphOverride): CustomTypeface {
  const overrides = { ...face.overrides }
  if (isEmpty(next)) delete overrides[char]
  else overrides[char] = next
  return { ...face, overrides }
}

/** Set (or with `undefined`, remove) per-glyph parameter overrides. Other overrides on the glyph are kept. */
export function setGlyphParams(face: CustomTypeface, char: string, params: { [K in keyof GlyphParams]?: GlyphParams[K] | undefined }): CustomTypeface {
  const current = face.overrides[char] ?? {}
  const merged: GlyphParams = { ...current.params }
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) delete (merged as Record<string, unknown>)[k]
    else (merged as Record<string, unknown>)[k] = v
  }
  const { params: _old, ...rest } = current
  void _old
  return withOverride(face, char, Object.keys(merged).length > 0 ? { ...rest, params: merged } : rest)
}

export interface Spacing {
  advanceWidth?: number | undefined
  leftBearing?: number | undefined
  rightBearing?: number | undefined
}

export function setGlyphSpacing(face: CustomTypeface, char: string, spacing: Spacing): CustomTypeface {
  const current = { ...(face.overrides[char] ?? {}) }
  for (const key of ['advanceWidth', 'leftBearing', 'rightBearing'] as const) {
    if (!(key in spacing)) continue
    const v = spacing[key]
    if (v === undefined) delete current[key]
    else current[key] = Math.round(v)
  }
  return withOverride(face, char, current)
}

/**
 * Freeze a glyph's current outline into its override. From then on global shape parameters no longer
 * change this glyph (spacing overrides still apply). Returns the face unchanged if the glyph cannot be built.
 */
export function freezeGlyph(face: CustomTypeface, char: string): CustomTypeface {
  const current = face.overrides[char]
  const live = generateGlyph(face.dna, char, current ? { ...current, contours: undefined } : undefined)
  if (!live.ok) return face
  return withOverride(face, char, { ...current, contours: live.glyph.contours, advanceWidth: current?.advanceWidth ?? live.glyph.advanceWidth })
}

/** Drop only the frozen outline so the glyph follows the global shape settings again; other overrides stay. */
export function unfreezeGlyph(face: CustomTypeface, char: string): CustomTypeface {
  const current = face.overrides[char]
  if (!current?.contours) return face
  const { contours: _drop, ...rest } = current
  void _drop
  return withOverride(face, char, rest)
}

/** Remove every override on one glyph so it follows the global design again. */
export function resetGlyph(face: CustomTypeface, char: string): CustomTypeface {
  if (!(char in face.overrides)) return face
  const overrides = { ...face.overrides }
  delete overrides[char]
  return { ...face, overrides }
}

export function resetAllOverrides(face: CustomTypeface): CustomTypeface {
  return Object.keys(face.overrides).length === 0 ? face : { ...face, overrides: {} }
}

/* ---------- variants ---------- */

export function saveVariant(face: CustomTypeface, v: { name: string; dna: Dna; origin: Variant['origin']; favourite?: boolean }, stamp: Stamp): CustomTypeface {
  const variant: Variant = { id: stamp.id, name: v.name.trim().slice(0, 60) || 'Variant', dna: v.dna, favourite: v.favourite ?? false, origin: v.origin, createdAt: stamp.at }
  return { ...face, variants: [variant, ...face.variants].slice(0, VARIANT_LIMIT) }
}

export function toggleFavourite(face: CustomTypeface, variantId: string): CustomTypeface {
  return { ...face, variants: face.variants.map((v) => (v.id === variantId ? { ...v, favourite: !v.favourite } : v)) }
}

export function deleteVariant(face: CustomTypeface, variantId: string): CustomTypeface {
  return { ...face, variants: face.variants.filter((v) => v.id !== variantId) }
}

export function renameVariant(face: CustomTypeface, variantId: string, name: string): CustomTypeface {
  const clean = name.trim().slice(0, 60)
  return clean ? { ...face, variants: face.variants.map((v) => (v.id === variantId ? { ...v, name: clean } : v)) } : face
}

/** Make a saved variant the current design (current design is checkpointed). Overrides are kept. */
export function applyVariant(face: CustomTypeface, variantId: string, stamp: Stamp): CustomTypeface {
  const v = face.variants.find((x) => x.id === variantId)
  if (!v) return face
  return setDna(checkpoint(face, `Before applying “${v.name}”`, stamp), v.dna)
}
