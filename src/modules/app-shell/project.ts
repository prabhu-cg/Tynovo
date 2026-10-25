import { useOutletContext } from 'react-router'
import type { Project } from '@/modules/brand-projects/schema'
import type { ProjectEditor } from './useProjectEditor'

export interface ProjectContext {
  /** The live draft (never null inside project routes). */
  draft: Project
  editor: ProjectEditor
}

export const useProject = () => useOutletContext<ProjectContext>()
