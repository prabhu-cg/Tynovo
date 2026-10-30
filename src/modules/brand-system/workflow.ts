import type { Project } from '@/modules/brand-projects/schema'
import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { brandDefined } from './brand'
import { resolveRole, rolesUsingCustom } from './fonts'
import { typographyIssues } from '@/modules/typography-system/validate'
import { assessProject, countLevels } from './readiness'

/**
 * Where a project stands on the shared path: brand, typography system, custom typeface, apply the font to
 * roles, preview, validate, export. Derived from the saved content every time; nothing is stored.
 */
export type StepState = 'done' | 'todo' | 'attention' | 'optional'

export interface WorkflowStep {
  id: 'brand' | 'fonts' | 'system' | 'scale' | 'typeface' | 'preview' | 'validate' | 'export'
  title: string
  /** One word for tight places (the workflow bar). */
  short: string
  state: StepState
  detail: string
  /** Relative route inside the project. */
  to: string
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function workflowSteps(project: Project, currentRevision: string | null): WorkflowStep[] {
  const roles = project.typography.roles
  const withFont = roles.filter((r) => resolveRole(project, r).origin !== 'none')
  const broken = roles.filter((r) => resolveRole(project, r).origin === 'broken')
  const custom = rolesUsingCustom(project)
  const face = project.customTypeface
  const items = assessProject(project)
  const counts = countLevels(items)
  const last = project.exportHistory.find((h) => h.sourceRevision)

  const hasFonts = project.fontSources.length > 0 || face !== null
  const scaleIssues = typographyIssues(project).length
  const steps: WorkflowStep[] = [
    {
      id: 'brand',
      title: 'Brand direction',
      short: 'Brand',
      state: brandDefined(project) ? 'done' : 'todo',
      detail: brandDefined(project) ? [project.brand.name.trim() || project.name, ...project.brand.tones, ...project.brand.useCases].filter(Boolean).join(', ') : 'Name the brand and set its tone and use cases.',
      to: '.#brand',
    },
    {
      id: 'fonts',
      title: 'Select font families',
      short: 'Fonts',
      state: hasFonts ? 'done' : 'todo',
      detail: hasFonts ? `${plural(project.fontSources.length, 'existing font')}${face ? ' and your own typeface' : ''}.` : 'Browse the catalog and add fonts.',
      to: 'fonts',
    },
    {
      id: 'system',
      title: 'Assign typography roles',
      short: 'Roles',
      state: broken.length > 0 ? 'attention' : withFont.length === roles.length && roles.length > 0 ? 'done' : 'todo',
      detail: broken.length > 0 ? `${plural(broken.length, 'role')} point at a missing font.` : `${withFont.length} of ${plural(roles.length, 'role')} have a font.`,
      to: 'typography#roles',
    },
    {
      id: 'scale',
      title: 'Adjust the type scale',
      short: 'Scale',
      state: scaleIssues > 0 ? 'attention' : 'done',
      detail: scaleIssues > 0 ? `${plural(scaleIssues, 'value')} worth a second look.` : `${project.typography.scale.baseSizePx}px base, ratio ${project.typography.scale.ratio}${project.typography.responsive.enabled ? ', fluid' : ''}.`,
      to: 'typography#scale',
    },
    {
      id: 'typeface',
      title: 'Custom typeface',
      short: 'Typeface',
      state: face ? 'done' : 'optional',
      detail: face ? `${face.familyName}, ${analyzeTypeface(face).supportedCount} characters${custom.length > 0 ? `, used in ${custom.map((r) => r.name).join(', ')}` : ', not used by a role yet'}.` : 'Optional: design an original typeface.',
      to: 'typeface',
    },
    {
      id: 'preview',
      title: 'Preview',
      short: 'Preview',
      state: withFont.length > 0 ? 'done' : 'todo',
      detail: withFont.length > 0 ? 'Website, editorial, product interface, poster and printed document, light and dark.' : 'Assign a font to see previews.',
      to: 'typography#previews',
    },
    {
      id: 'validate',
      title: 'Validate',
      short: 'Validate',
      state: counts.blocks > 0 || counts.warns > 0 ? 'attention' : 'done',
      detail: counts.blocks + counts.warns > 0 ? `${plural(counts.blocks, 'blocking issue')}, ${plural(counts.warns, 'warning')}.` : 'Nothing to fix.',
      to: 'export',
    },
    {
      id: 'export',
      title: 'Export',
      short: 'Export',
      state: !last ? 'todo' : currentRevision === null || last.sourceRevision === currentRevision ? 'done' : 'attention',
      detail: !last ? 'Nothing exported yet.' : currentRevision === null || last.sourceRevision === currentRevision ? `Last export matches the saved project.` : 'The project changed since the last export.',
      to: 'export',
    },
  ]
  return steps
}

/** Which step the person is on, from where they are inside the project (the path after its id) and the #anchor. */
export function activeStepId(sub: string, hash: string): WorkflowStep['id'] | null {
  const page = sub.replace(/^\/+|\/+$/g, '')
  const anchor = hash.replace(/^#/, '')
  if (page === '') return 'brand'
  if (page === 'fonts') return 'fonts'
  if (page === 'typeface') return 'typeface'
  if (page === 'export') return 'export'
  if (page === 'typography') return anchor === 'scale' ? 'scale' : anchor === 'previews' ? 'preview' : 'system'
  return null
}

/** The step to do next: the first that is still to do or needs attention. Optional steps are never "next". */
export function nextStep(steps: readonly WorkflowStep[]): WorkflowStep | null {
  return steps.find((s) => s.state === 'todo' || s.state === 'attention') ?? null
}

/** Steps that count towards "done": everything except an optional step that has not been done. */
export function progressOf(steps: readonly WorkflowStep[]): { done: number; total: number } {
  const counted = steps.filter((s) => s.state !== 'optional')
  return { done: counted.filter((s) => s.state === 'done').length, total: counted.length }
}
