import { useEffect, useMemo, useRef, useState } from 'react'
import type { CustomTypeface } from '@/modules/brand-projects/schema'
import { previewFamilyName } from '@/modules/brand-system/fonts'
import { fontFluxBuilder } from './fontFluxBuilder'

export type ProjectFontState = 'none' | 'loading' | 'ready' | 'failed'

export interface ProjectFont {
  /** The name the browser knows the project's typeface by; null when there is none. */
  family: string | null
  state: ProjectFontState
  /** Counts finished registrations. It changes every time the browser got a new build of the typeface. */
  revision: number
  error: string | null
}

const SETTLE_MS = 300

/**
 * Registers the project's generated typeface with the browser, so any preview can use it by name, and keeps it
 * current: when the design changes, a new font file is built from the saved glyph model and swapped in. The old
 * registration is removed only after the new one is loaded, so text never flashes into the fallback font.
 * Edits that do not change how glyphs look (licence, copyright, saved variants, restore points) do not rebuild.
 */
export function useProjectFont(face: CustomTypeface | null): ProjectFont {
  const designKey = useMemo(
    () => (face ? JSON.stringify([face.id, face.engineVersion, face.dna, face.overrides, face.kerning]) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [face?.id, face?.engineVersion, face?.dna, face?.overrides, face?.kerning],
  )
  const faceRef = useRef(face)
  useEffect(() => {
    faceRef.current = face
  })

  const [settledKey, setSettledKey] = useState<string | null>(null)
  const first = useRef(true)
  useEffect(() => {
    if (designKey === null) {
      setSettledKey(null)
      return
    }
    const t = setTimeout(() => setSettledKey(designKey), first.current ? 0 : SETTLE_MS)
    first.current = false
    return () => clearTimeout(t)
  }, [designKey])

  const [result, setResult] = useState<{ key: string; state: 'ready' | 'failed'; revision: number; error: string | null } | null>(null)
  const registered = useRef<FontFace | null>(null)
  const count = useRef(0)

  useEffect(() => {
    const current = faceRef.current
    if (settledKey === null || !current) return
    let cancelled = false
    void (async () => {
      try {
        if (typeof FontFace === 'undefined') throw new Error('This browser cannot register fonts.')
        const { bytes } = await fontFluxBuilder.build({ typeface: current, timestamp: '2026-01-01T00:00:00.000Z', version: '1.000' })
        const ff = new FontFace(previewFamilyName(current), bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
        await ff.load()
        if (cancelled) return
        document.fonts.add(ff)
        if (registered.current) document.fonts.delete(registered.current)
        registered.current = ff
        count.current += 1
        setResult({ key: settledKey, state: 'ready', revision: count.current, error: null })
      } catch (e) {
        if (!cancelled) setResult({ key: settledKey, state: 'failed', revision: count.current, error: e instanceof Error ? e.message : 'The font could not be built.' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [settledKey])

  // Take the registration away when the project has no typeface any more, or the view is closed.
  useEffect(() => {
    if (face === null && registered.current) {
      document.fonts.delete(registered.current)
      registered.current = null
    }
  }, [face])
  useEffect(
    () => () => {
      if (registered.current) document.fonts.delete(registered.current)
      registered.current = null
    },
    [],
  )

  if (!face || designKey === null) return { family: null, state: 'none', revision: 0, error: null }
  const family = previewFamilyName(face)
  if (result && result.key === designKey) return { family, state: result.state, revision: result.revision, error: result.error }
  // A newer design is on its way; keep reporting the last good font as usable.
  return { family, state: registered.current ? 'ready' : 'loading', revision: result?.revision ?? 0, error: null }
}
