import { useEffect, useState } from 'react'
import type { CustomTypeface } from '@/modules/brand-projects/schema'
import { fontFluxBuilder } from './fontFluxBuilder'

export type FontFaceState = 'loading' | 'ready' | 'failed'

/**
 * Build a real TrueType file from the typeface and register it with the browser as a FontFace.
 * What the page shows in `family` is rendered by the browser from the exported bytes, not from SVG.
 */
export function useGeneratedFontFace(face: CustomTypeface, family: string): FontFaceState {
  // Keyed by the inputs so a stale result is never reported for a newer typeface.
  const [done, setDone] = useState<{ face: CustomTypeface; state: FontFaceState } | null>(null)
  useEffect(() => {
    let registered: FontFace | null = null
    let cancelled = false
    const finish = (state: FontFaceState) => !cancelled && setDone({ face, state })
    void (async () => {
      try {
        const { bytes } = await fontFluxBuilder.build({ typeface: face, timestamp: '2026-01-01T00:00:00.000Z', version: '1.000' })
        const ff = new FontFace(family, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
        await ff.load()
        if (cancelled) return
        document.fonts.add(ff)
        registered = ff
        finish('ready')
      } catch {
        finish('failed')
      }
    })()
    return () => {
      cancelled = true
      if (registered) document.fonts.delete(registered)
    }
  }, [face, family])
  return done?.face === face ? done.state : 'loading'
}
