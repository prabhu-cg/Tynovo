import type { Project } from '@/modules/brand-projects/schema'
import { sizeForStep } from '@/modules/typography-system/scale'
import { validateTypeface } from '@/modules/font-validation/validate'
import { assessRoleFit } from './fit'
import { fontsInUse, isExisting, resolveRole, rolesUsingCustom } from './fonts'
import { applicationSlots, APPLICATIONS, effectiveCopy, previewMissing, type PreviewCopy } from './preview'
import { typographyIssues } from '@/modules/typography-system/validate'
import type { Availability } from './availability'
import { describeAvailability } from './availability'
import { LICENSE_PLACEHOLDER } from '@/modules/typeface-engine/typeface'

/**
 * The "validate" step of the workflow: everything about the combined project that a person should know before
 * exporting. Pure: the same project always gives the same list. Nothing here is a score.
 *  blocks  something an export cannot do, or would get wrong
 *  warns   probably not what was intended
 *  info    good to know
 */
export type ReadinessLevel = 'blocks' | 'warns' | 'info'
export type ReadinessArea = 'typography' | 'typeface' | 'export'

export interface ReadinessItem {
  id: string
  level: ReadinessLevel
  area: ReadinessArea
  message: string
  roleId?: string
}

export const LEVEL_ORDER: Record<ReadinessLevel, number> = { blocks: 0, warns: 1, info: 2 }

export function assessProject(project: Project, copy: PreviewCopy = effectiveCopy(project), availability?: ReadonlyMap<string, Availability>): ReadinessItem[] {
  const out: ReadinessItem[] = []
  const add = (i: ReadinessItem) => out.push(i)
  const face = project.customTypeface

  for (const role of project.typography.roles) {
    const font = resolveRole(project, role)
    if (font.origin === 'none') {
      add({ id: `role.none.${role.id}`, level: 'warns', area: 'typography', roleId: role.id, message: `${role.name} has no font assigned, so exports leave it to the page's inherited font.` })
    } else if (font.origin === 'broken') {
      add({ id: `role.broken.${role.id}`, level: 'warns', area: 'typography', roleId: role.id, message: `${role.name} points at a font that is no longer in the project. It is drawn and exported without a font.` })
    }
    if (font.origin === 'custom' && face) {
      const fit = assessRoleFit(face, role, sizeForStep(project.typography.scale, role.scaleStep))
      for (const f of fit.findings) {
        if (f.level === 'notes') continue
        add({ id: `fit.${role.id}.${f.id}`, level: f.level === 'blocks' ? 'blocks' : 'warns', area: 'typography', roleId: role.id, message: `${role.name}: ${f.message}` })
      }
    }
    if (font.source && font.source.weights.length > 0 && !font.source.weights.includes(role.weight)) {
      add({ id: `weight.unavailable.${role.id}`, level: 'info', area: 'typography', roleId: role.id, message: `${role.name} uses weight ${role.weight}, which ${font.family} does not offer in Tynovo (${font.source.weights.join(', ')}). Browsers use the nearest weight.` })
    }
  }

  for (const t of typographyIssues(project)) {
    add({ id: `typography.${t.id}`, level: 'warns', area: 'typography', ...(t.roleId ? { roleId: t.roleId } : {}), message: t.message })
  }
  if (availability) {
    for (const u of fontsInUse(project)) {
      const src = u.font.source
      const a = src ? availability.get(src.id) : undefined
      if (!src || !a) continue
      if (a.status === 'failed' || a.status === 'unavailable' || a.status === 'not-detected') {
        add({ id: `availability.${src.id}`, level: 'warns', area: 'typography', message: `${src.family} is used by ${u.roles.map((r) => r.name).join(', ')}, but ${describeAvailability(a, src).charAt(0).toLowerCase()}${describeAvailability(a, src).slice(1)}` })
      }
    }
  }

  const slots = APPLICATIONS.flatMap((a) => applicationSlots(project, copy, a.id))
  for (const m of previewMissing(project, slots)) {
    add({ id: `preview.missing.${m.role.id}`, level: 'warns', area: 'typography', roleId: m.role.id, message: `${m.role.name} previews contain characters the custom typeface lacks (${m.chars.join(' ')}); they are drawn in a fallback font.` })
  }

  if (face) {
    const used = rolesUsingCustom(project).length > 0
    const summary = validateTypeface(face)
    if (!summary.exportable) {
      add({ id: 'typeface.not-exportable', level: used ? 'blocks' : 'warns', area: 'typeface', message: `The typeface has ${summary.errorCount} error${summary.errorCount === 1 ? '' : 's'}, so no font file can be built. CSS, the specimen and the package need that file${used ? ' and are unavailable' : ''}.` })
    }
    if (used && (face.license.name === LICENSE_PLACEHOLDER || !face.license.verified)) {
      add({ id: 'typeface.licence', level: 'warns', area: 'typeface', message: face.license.name === LICENSE_PLACEHOLDER ? 'No licence is chosen for the custom typeface, so the manifest and font file carry none.' : 'The custom typeface’s licence has not been confirmed by you.' })
    }
    const clash = project.fontSources.find((s) => s.family.toLowerCase() === face.familyName.toLowerCase())
    if (clash && used) {
      add({ id: 'typeface.name-clash', level: 'warns', area: 'typeface', message: `The custom typeface and the existing font “${clash.family}” share a name; CSS using both would be ambiguous. Rename the typeface.` })
    }
  }

  for (const use of fontsInUse(project)) {
    if (!isExisting(use.font.origin)) continue
    add({ id: `external.${use.key}`, level: 'info', area: 'export', message: `${use.font.family} is an existing font and is not included in exports. The CSS names it; supply the font file separately${use.font.origin === 'system' ? ' (or rely on it being installed on the viewer’s device)' : ''}.` })
    if (use.font.license && !use.font.license.verified) {
      add({ id: `licence.${use.key}`, level: 'warns', area: 'export', message: `No licence is recorded for ${use.font.family}. Check that your use (web, app, print) is allowed before shipping.` })
    }
  }

  return out.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])
}

export const countLevels = (items: readonly ReadinessItem[]) => ({
  blocks: items.filter((i) => i.level === 'blocks').length,
  warns: items.filter((i) => i.level === 'warns').length,
  info: items.filter((i) => i.level === 'info').length,
})
