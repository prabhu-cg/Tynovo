import { useOutletContext } from 'react-router'
import type { Project } from '@/modules/brand-projects/schema'
import type { ProjectEditor } from './useProjectEditor'

/**
 * Work that lives in a screen and is not in the project yet (an outline being edited). While one is registered,
 * leaving the screen asks first, so it is never lost silently.
 */
export interface DraftGuard {
  /** Plain description for the prompt, e.g. "Glyph H has outline changes that are not applied". */
  describe: () => string
  isDirty: () => boolean
  /** Put the work into the project. */
  apply: () => void
  /** Throw it away. */
  discard: () => void
}

export interface ProjectContext {
  /** The live draft (never null inside project routes). */
  draft: Project
  editor: ProjectEditor
  /** Register (or with null, remove) the screen's unapplied work. */
  setGuard: (guard: DraftGuard | null) => void
}

export const useProject = () => useOutletContext<ProjectContext>()
