import type { Project, RoleKind, TypographyRole } from '@/modules/brand-projects/schema'
import { cssSize, sizeAt, sizeSpec, type SizeSpec } from './scale'

/**
 * The one description of the typography system. Previews, CSS, JSON tokens, the specification and the specimen
 * all read these styles, so what is on screen is, by construction, what is exported.
 *
 * A style is a role (display, heading, body, interface, caption), a heading level (H1 to H6, set in the heading
 * role's font) or an extra body size (large, small; set in the body role's font).
 */
export interface TypeStyle {
  /** Stable key: the role id, "h1".."h6", "body-lg", "body-sm". */
  id: string
  label: string
  kind: 'role' | 'level' | 'body-size'
  /** The role whose font, weight, line height and spacing the style uses. Null if the project has no role of that kind. */
  role: TypographyRole | null
  roleKind: RoleKind
  step: number
}

export const LEVEL_IDS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

const first = (project: Pick<Project, 'typography'>, kind: RoleKind) => project.typography.roles.find((r) => r.kind === kind) ?? null

export function typeStyles(project: Pick<Project, 'typography'>): TypeStyle[] {
  const { roles, sizes } = project.typography
  const out: TypeStyle[] = roles.map((r) => ({ id: r.id, label: r.name, kind: 'role', role: r, roleKind: r.kind, step: r.scaleStep }))
  const heading = first(project, 'heading')
  const body = first(project, 'body')
  sizes.headings.forEach((step, i) => out.push({ id: LEVEL_IDS[i]!, label: `Heading ${i + 1}`, kind: 'level', role: heading, roleKind: 'heading', step }))
  out.push({ id: 'body-lg', label: 'Body large', kind: 'body-size', role: body, roleKind: 'body', step: sizes.bodyLarge })
  out.push({ id: 'body-sm', label: 'Body small', kind: 'body-size', role: body, roleKind: 'body', step: sizes.bodySmall })
  return out
}

export const findStyle = (project: Pick<Project, 'typography'>, id: string): TypeStyle | undefined => typeStyles(project).find((s) => s.id === id)

/** Size information of a style, from the scale and the responsive settings. */
export const styleSize = (project: Pick<Project, 'typography'>, style: Pick<TypeStyle, 'step'>): SizeSpec => sizeSpec(project.typography, style.step)

/** Pixel size of a style at a viewport width (the width the preview is showing). */
export const styleSizeAt = (project: Pick<Project, 'typography'>, style: Pick<TypeStyle, 'step'>, viewportPx: number): number => sizeAt(project.typography, style.step, viewportPx)

/** CSS font-size value of a style, as written into the exported stylesheet. */
export const styleCssSize = (project: Pick<Project, 'typography'>, style: Pick<TypeStyle, 'step'>): string => cssSize(project.typography, style.step)
