import { useOutletContext } from 'react-router'
import type { Project } from '@/modules/brand-projects/schema'
import type { ProjectFont } from '@/modules/font-export/useProjectFont'
import type { ProjectFonts } from './useProjectFonts'
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
  /** The project's typeface as registered with the browser for previews. Shared by every screen. */
  customFont: ProjectFont
  /** Whether each existing font in the project can really be drawn right now. */
  fonts: ProjectFonts
  /** Register (or with null, remove) the screen's unapplied work. */
  setGuard: (guard: DraftGuard | null) => void
}

export const useProject = () => useOutletContext<ProjectContext>()
