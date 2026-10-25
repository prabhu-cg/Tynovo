import { projectFilename, serializeProject } from '@/modules/brand-projects/model'
import type { Project } from '@/modules/brand-projects/schema'
import { downloadBytes } from '@/modules/font-export/download'

/** Save a project file to the user's disk. Works from the draft in memory, so it also works when storage is failing. */
export function exportProjectFile(project: Project): string {
  downloadBytes(new TextEncoder().encode(serializeProject(project)), projectFilename(project), 'application/json')
  return projectFilename(project)
}
