import type { Clock } from '@/modules/brand-projects/model'

/** Deterministic clock: ids "id-1", "id-2"… and time advancing one second per call to now(). */
export function fakeClock(start = '2026-01-01T00:00:00.000Z'): Clock {
  let n = 0
  let t = new Date(start).getTime()
  return {
    now: () => new Date((t += 1000)),
    newId: () => `id-${++n}`,
  }
}

import { createProject } from '@/modules/brand-projects/model'
import type { Project } from '@/modules/brand-projects/schema'
import { addCatalogFont, addNamedFont, assignCustomTypeface, assignSource, updateRole } from '@/modules/brand-system/ops'
import { createTypeface } from '@/modules/typeface-engine/typeface'

/**
 * A project that exercises the whole shared path: a custom typeface on Display and Heading, a bundled existing
 * font on Body, a font named by the user on the UI role.
 */
export function integratedProject(name = 'Northwind', clock = fakeClock()): Project {
  let p = createProject(name, clock)
  p = { ...p, brand: { ...p.brand, personality: ['precise', 'warm'], notes: 'Line one\nLine two' }, customTypeface: createTypeface('face-1', 'geometric', 'Northwind Sans') }
  const [display, heading, body, ui, caption] = p.typography.roles
  p = assignCustomTypeface(p, display!.id)
  p = assignCustomTypeface(p, heading!.id)
  p = updateRole(p, display!.id, { weight: 400 })
  p = updateRole(p, heading!.id, { weight: 400 })
  const cat = addCatalogFont(p, 'manrope', clock)!
  p = assignSource(assignSource(cat.project, body!.id, cat.sourceId), caption!.id, cat.sourceId)
  const named = addNamedFont(p, 'Helvetica Neue', 'sans-serif', clock)!
  return assignSource(named.project, ui!.id, named.sourceId)
}
