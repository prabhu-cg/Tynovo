import { brandName } from '@/modules/brand-system/brand'
import { resolveRole, roleSlugs } from '@/modules/brand-system/fonts'
import { computeScale, cssSize, sizeSpec } from '@/modules/typography-system/scale'
import { typeStyles } from '@/modules/typography-system/tokens'
import { stackList } from './stack'
import type { ExportInput } from './types'

const round = (n: number, d = 4) => Number(n.toFixed(d))

/**
 * Design tokens in the Design Tokens Community Group format ($type / $value), plus the studio's own `project`
 * block with the brand direction and settings. Values are literal rather than references so tools that do not
 * resolve aliases still read them. Sizes are the large-screen values; when responsive sizing is on, the small
 * value and the exact CSS clamp() are under $extensions. Which font is custom and which is existing is kept
 * under $extensions, where tools that ignore it will not trip.
 */
export function buildTokens(input: ExportInput): string {
  const { project } = input
  const { typography, brand } = project
  const slugs = roleSlugs(typography.roles)
  const ext = 'com.brand-typography-studio'

  const scale: Record<string, unknown> = {}
  for (const s of computeScale(typography.scale)) {
    const spec = sizeSpec(typography, s.step)
    scale[`step-${s.step}`] = { $type: 'dimension', $value: `${spec.maxPx}px`, ...(spec.fluid ? { $extensions: { [ext]: { minPx: spec.minPx, css: cssSize(typography, s.step) } } } : {}) }
  }

  const family: Record<string, unknown> = {}
  const roles: Record<string, unknown> = {}
  const fontMeta = (role: NonNullable<ReturnType<typeof typeStyles>[number]['role']>) => {
    const f = resolveRole(project, role)
    const hasFont = f.origin !== 'none' && f.origin !== 'broken'
    return {
      f,
      hasFont,
      families: hasFont ? stackList(f.exportStack) : [],
      meta: { origin: f.origin, family: hasFont ? f.family : null, licence: f.license ? { name: f.license.name, spdx: f.license.spdx ?? null, verified: f.license.verified } : null, includedInExport: f.origin === 'custom' && input.font !== null },
    }
  }
  const styleToken = (role: NonNullable<ReturnType<typeof typeStyles>[number]['role']>, step: number, label: string, extra: Record<string, unknown>) => {
    const { families, meta } = fontMeta(role)
    const spec = sizeSpec(typography, step)
    return {
      $type: 'typography',
      $value: { fontFamily: families, fontSize: `${spec.maxPx}px`, fontWeight: role.weight, lineHeight: role.lineHeight, letterSpacing: `${round(role.letterSpacingEm)}em` },
      $description: label,
      $extensions: { [ext]: { ...meta, ...extra, scaleStep: step, ...(spec.fluid ? { minPx: spec.minPx, cssFontSize: cssSize(typography, step) } : {}) } },
    }
  }

  for (const role of typography.roles) {
    const slug = slugs.get(role.id)!
    const { hasFont, families, meta } = fontMeta(role)
    if (hasFont) family[slug] = { $type: 'fontFamily', $value: families, $extensions: { [ext]: meta } }
    roles[slug] = styleToken(role, role.scaleStep, role.name, { role: role.name, kind: role.kind })
  }
  const levels: Record<string, unknown> = {}
  const bodySizes: Record<string, unknown> = {}
  for (const s of typeStyles(project).filter((x) => x.kind !== 'role')) {
    if (!s.role) continue
    const token = styleToken(s.role, s.step, s.label, { role: s.role.name, kind: s.roleKind })
    if (s.kind === 'level') levels[s.id] = token
    else bodySizes[s.id] = token
  }

  const r = typography.responsive
  return (
    JSON.stringify(
      {
        $description: `Typography tokens for ${brandName(project)}. Brand Typography Studio, project revision ${input.revision}.`,
        $extensions: {
          [ext]: {
            revision: input.revision,
            generatedAt: input.generatedAt,
            scale: typography.scale,
            responsive: r.enabled ? r : { enabled: false },
            brand: { name: brandName(project), description: brand.description, personality: brand.personality, useCases: brand.useCases, tones: brand.tones, readabilityPriority: brand.readabilityPriority, displayPriority: brand.displayPriority },
          },
        },
        scale,
        font: { family },
        typography: roles,
        heading: levels,
        body: bodySizes,
      },
      null,
      2,
    ) + '\n'
  )
}
