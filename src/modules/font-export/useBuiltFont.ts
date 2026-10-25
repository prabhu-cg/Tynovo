import { useEffect, useState } from 'react'
import type { CustomTypeface } from '@/modules/brand-projects/schema'
import { validateFontBinary, validateTypeface, type ValidationSummary } from '@/modules/font-validation/validate'
import { sha256Hex } from './download'
import { fontFluxBuilder } from './fontFluxBuilder'
import { loadFontFlux } from './loadFontFlux'
import type { FontBuildResult } from './types'

export interface BuiltFont {
  typeface: CustomTypeface
  build: FontBuildResult
  model: ValidationSummary
  binary: ValidationSummary
  sha256: string
  /** Facts read back from the produced bytes, not echoed from the input. */
  readBack: { family: string | undefined; glyphs: number; tables: string[]; format: string }
}

/** Build, validate and re-open a font for display. Result is null while a newer build is pending. */
export function useBuiltFont(typeface: CustomTypeface): { built: BuiltFont | null; error: string | null } {
  const [state, setState] = useState<{ built: BuiltFont | null; error: string | null; for: CustomTypeface } | null>(null)
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const build = await fontFluxBuilder.build({ typeface, timestamp: new Date().toISOString(), version: '1.000' })
        const [binary, sha256, { FontFlux }] = await Promise.all([validateFontBinary(build.bytes), sha256Hex(build.bytes), loadFontFlux()])
        const f = FontFlux.open(build.bytes)
        const built: BuiltFont = {
          typeface,
          build,
          model: validateTypeface(typeface),
          binary,
          sha256,
          readBack: { family: f.info.familyName, glyphs: f.glyphCount, tables: Object.keys(f.tables ?? {}), format: f.format },
        }
        if (live) setState({ built, error: null, for: typeface })
      } catch (e) {
        if (live) setState({ built: null, error: e instanceof Error ? e.message : 'Build failed.', for: typeface })
      }
    })()
    return () => {
      live = false
    }
  }, [typeface])
  return state?.for === typeface ? { built: state.built, error: state.error } : { built: null, error: null }
}
