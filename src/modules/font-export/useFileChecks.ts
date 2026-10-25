import { useEffect, useState } from 'react'
import type { CustomTypeface } from '@/modules/brand-projects/schema'
import { verifyFontBytes } from '@/modules/font-validation/readback'
import { validateFontBinary, type ValidationIssue } from '@/modules/font-validation/validate'
import { fontFluxBuilder } from './fontFluxBuilder'
import type { FontFormatId } from './formats'
import { FONT_VERSION } from './typefaceExport'

export type FileChecks =
  | { status: 'checking' }
  | { status: 'failed'; message: string }
  | { status: 'done'; issues: ValidationIssue[]; passed: string[]; bytes: number }

/**
 * Build the font in the background and run the same read-back checks the export runs, so the quality report can
 * show file problems before anyone presses Export. Nothing is stored or downloaded.
 */
export function useFileChecks(face: CustomTypeface, format: FontFormatId): FileChecks {
  const [done, setDone] = useState<{ face: CustomTypeface; format: FontFormatId; result: FileChecks } | null>(null)
  useEffect(() => {
    let live = true
    void (async () => {
      let result: FileChecks
      try {
        const build = await fontFluxBuilder.build({ typeface: face, timestamp: new Date().toISOString(), version: FONT_VERSION, format })
        const [lib, read] = await Promise.all([validateFontBinary(build.bytes), verifyFontBytes(build.bytes, face, format, FONT_VERSION)])
        result = { status: 'done', issues: [...lib.issues, ...read.issues], passed: read.passed, bytes: build.bytes.byteLength }
      } catch (e) {
        result = { status: 'failed', message: e instanceof Error ? e.message : 'The file could not be built.' }
      }
      if (live) setDone({ face, format, result })
    })()
    return () => {
      live = false
    }
  }, [face, format])
  return done && done.face === face && done.format === format ? done.result : { status: 'checking' }
}
