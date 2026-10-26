import { useEffect, useMemo, useRef, useState } from 'react'
import type { Project } from '@/modules/brand-projects/schema'
import { canonicalJson, exportedContent } from '@/modules/brand-system/revision'
import { buildBundle, type ExportBundle } from '@/modules/export-centre/bundle'

export type BundleState = { status: 'building' } | { status: 'ready'; bundle: ExportBundle } | { status: 'error'; message: string }

/**
 * Every export, built from the SAVED project. It rebuilds only when exported content changes, not when
 * the project is merely saved again (for example after an export is recorded in the history).
 */
export function useBundle(saved: Project | null): BundleState {
  const key = useMemo(() => (saved ? canonicalJson(exportedContent(saved)) : null), [saved])
  const latest = useRef(saved)
  useEffect(() => {
    latest.current = saved
  })
  const [done, setDone] = useState<{ key: string; value: BundleState } | null>(null)

  useEffect(() => {
    const project = latest.current
    if (key === null || !project) return
    let live = true
    void buildBundle(project, { now: () => new Date(), newId: () => crypto.randomUUID() }).then(
      (bundle) => live && setDone({ key, value: { status: 'ready', bundle } }),
      (e: unknown) => live && setDone({ key, value: { status: 'error', message: e instanceof Error ? e.message : 'The exports could not be prepared.' } }),
    )
    return () => {
      live = false
    }
  }, [key])

  return done && done.key === key ? done.value : { status: 'building' }
}
