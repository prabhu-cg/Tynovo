import { useEffect, useState } from 'react'
import type { Project } from '@/modules/brand-projects/schema'
import { contentRevision } from '@/modules/brand-system/revision'

/** Revision of a project's exported content (see brand-system/revision). Null until it is computed. */
export function useContentRevision(project: Project | null): string | null {
  const [state, setState] = useState<{ project: Project; revision: string } | null>(null)
  useEffect(() => {
    if (!project) return
    let live = true
    void contentRevision(project).then((revision) => live && setState({ project, revision }))
    return () => {
      live = false
    }
  }, [project])
  return state && state.project === project ? state.revision : null
}
