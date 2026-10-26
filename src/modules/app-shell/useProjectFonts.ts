import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { Project } from '@/modules/brand-projects/schema'
import { sourceAvailability, type Availability } from '@/modules/brand-system/availability'
import { catalogFontFor } from '@/modules/font-catalog/catalog'
import { detectInstalled, type Installed } from '@/modules/font-catalog/installed'
import { fontLoader, nearestWeight, specKey, type FontSpec } from '@/modules/font-catalog/loader'

export interface ProjectFonts {
  /** By font-source id. A font is "loaded" or "installed" only when that is true. */
  availability: ReadonlyMap<string, Availability>
  /** Try again for a catalog font whose file failed to load. */
  retry: (sourceId: string) => void
}

/** The files each catalog font in the project needs: the weights its roles ask for (as the browser would pick them), at least regular. */
function specsFor(project: Project): Map<string, FontSpec[]> {
  const out = new Map<string, FontSpec[]>()
  for (const s of project.fontSources) {
    const cat = s.kind === 'catalog' ? catalogFontFor(s.family) : undefined
    if (!cat) continue
    const weights = new Set<number>([nearestWeight(cat.weights, 400)])
    for (const r of project.typography.roles) if (r.font?.kind === 'source' && r.font.sourceId === s.id) weights.add(nearestWeight(cat.weights, r.weight))
    out.set(s.id, [...weights].sort((a, b) => a - b).map((weight) => ({ id: cat.id, weight, style: 'normal' as const })))
  }
  return out
}

/**
 * Loads the catalog fonts the project uses (and only those), detects the named fonts installed on this device,
 * and reports what is really available. Catalog files load on demand from the studio itself; a failure is
 * reported, never hidden, and nothing is shown as available until it is.
 */
export function useProjectFonts(project: Project | null): ProjectFonts {
  useSyncExternalStore(fontLoader.subscribe, fontLoader.snapshot)

  const specs = useMemo(() => (project ? specsFor(project) : new Map<string, FontSpec[]>()), [project?.fontSources, project?.typography.roles]) // eslint-disable-line
  const specKeyString = [...specs.values()].flat().map(specKey).join(',')

  useEffect(() => {
    const all = [...specs.values()].flat()
    fontLoader.pin(all)
    for (const s of all) void fontLoader.load(s)
  }, [specKeyString]) // eslint-disable-line

  const families = (project?.fontSources ?? []).filter((s) => s.kind !== 'catalog').map((s) => s.family)
  const familyKey = families.join('\n')
  const [installed, setInstalled] = useState<Record<string, Installed>>({})
  useEffect(() => {
    let live = true
    const list = familyKey ? familyKey.split('\n') : []
    void document.fonts.ready.then(() => {
      if (!live) return
      setInstalled(Object.fromEntries(list.map((f) => [f, detectInstalled(f)])))
    })
    return () => {
      live = false
    }
  }, [familyKey])

  const availability = new Map<string, Availability>()
  for (const s of project?.fontSources ?? []) {
    const list = specs.get(s.id) ?? []
    const states = list.map((x) => fontLoader.state(x))
    const failed = list.find((x) => fontLoader.state(x) === 'failed')
    const load = failed ? 'failed' : states.length > 0 && states.every((x) => x === 'loaded') ? 'loaded' : 'loading'
    availability.set(s.id, sourceAvailability(s, { load, loadError: failed ? fontLoader.error(failed) : undefined, installed: installed[s.family] ?? 'unknown' }))
  }

  const retry = useCallback(
    (sourceId: string) => {
      for (const s of specs.get(sourceId) ?? []) if (fontLoader.state(s) === 'failed') void fontLoader.retry(s)
    },
    [specs],
  )
  return { availability, retry }
}
