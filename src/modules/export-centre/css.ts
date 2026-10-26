import { catalogFontFor } from '@/modules/font-catalog/catalog'
import { fontsInUse, ORIGIN_LABEL, quoteFamily, resolveRole, roleSlugs } from '@/modules/brand-system/fonts'
import { brandName } from '@/modules/brand-system/brand'
import { cssComment, cssString } from '@/modules/brand-system/text'
import { computeScale, cssSize } from '@/modules/typography-system/scale'
import { typeStyles } from '@/modules/typography-system/tokens'
import type { ExportInput } from './types'

export const rem = (px: number) => `${Number((px / 16).toFixed(4))}rem`

export interface CssOptions {
  /** Where the page finds the custom font. A relative path in the package, or a data: URI inside a single-file specimen. */
  fontUrl?: string
}

/** URL for the font file next to the CSS. */
export const fontPath = (filename: string) => `fonts/${filename}`

/**
 * CSS custom properties and font declarations for the saved project. Sizes, stacks, weights, line heights and
 * spacing are the very values the previews draw (typography-system/tokens). Existing fonts are named but never
 * bundled: their files are not ours to redistribute here, so the file says where they come from.
 */
export function buildCss(input: ExportInput, opts: CssOptions = {}): string {
  const { project, revision, font, fontBlocked } = input
  const { typography } = project
  const slugs = roleSlugs(typography.roles)
  const out: string[] = []
  out.push(`/* Typography for ${cssComment(brandName(project))}.`)
  out.push(` * Tynovo, project revision ${revision}. Generated ${input.generatedAt}. */`)

  const uses = fontsInUse(project)
  const custom = uses.find((u) => u.font.origin === 'custom')
  const existing = uses.filter((u) => u.font.origin !== 'custom')

  if (existing.length > 0) {
    out.push('', '/* Fonts used from elsewhere. Their files are NOT included in this export:')
    for (const u of existing) {
      const f = u.font
      const cat = f.source?.kind === 'catalog' ? catalogFontFor(f.source.family) : undefined
      const where = cat
        ? `from the ${cat.distribution} package (version ${cat.distributionVersion}), published upstream at ${cat.upstream}; install it or supply the font files`
        : f.source?.kind === 'system'
          ? 'named by you; it renders only where it is installed, so supply the font file or accept the fallback'
          : 'supply the font file yourself'
      out.push(` *  - ${cssComment(f.family)} (${ORIGIN_LABEL[f.origin]}): ${cssComment(where)}. Licence: ${cssComment(f.license?.name ?? 'not recorded')}${f.license && !f.license.verified ? ' (not verified)' : ''}.`)
    }
    out.push(' * Add your own @font-face rules for them, or install them where the page runs. */')
  }

  if (custom) {
    out.push('')
    if (font) {
      out.push('/* Your custom typeface. It has one style (regular, weight 400); bold and italic would be synthesised by the browser. */')
      out.push('@font-face {')
      out.push(`  font-family: ${cssString(custom.font.family)};`)
      out.push(`  src: url(${cssString(opts.fontUrl ?? fontPath(font.filename))}) format(${cssString(font.format === 'ttf' ? 'truetype' : 'opentype')});`)
      out.push('  font-weight: 400;', '  font-style: normal;', '  font-display: swap;', '}')
    } else {
      out.push(`/* The custom typeface ${cssComment(custom.font.family)} is used by ${custom.roles.map((r) => cssComment(r.name)).join(', ')}, but its font file ${fontBlocked ? 'could not be built (see the export checks), so no @font-face is declared and the fallback is used' : 'is not available'}. */`)
    }
  }

  out.push('', ':root {')
  const r = typography.responsive
  out.push(`  /* Type scale: ${typography.scale.baseSizePx}px base, ratio ${typography.scale.ratio}. rem assumes a 16px root. */`)
  if (r.enabled) out.push(`  /* Fluid: sizes move from the small scale (${r.minBaseSizePx}px, ratio ${r.minRatio}) at ${r.minViewportPx}px wide to the main scale at ${r.maxViewportPx}px wide. */`)
  for (const s of computeScale(typography.scale)) out.push(`  --type-step-${s.step < 0 ? `n${-s.step}` : s.step}: ${cssSize(typography, s.step)};`)
  for (const role of typography.roles) {
    const slug = slugs.get(role.id)!
    const f = resolveRole(project, role)
    out.push('', `  /* ${cssComment(role.name)}: ${f.origin === 'none' ? 'no font assigned' : f.origin === 'broken' ? 'font missing from the project' : `${cssComment(f.family)} (${ORIGIN_LABEL[f.origin]})`} */`)
    if (f.origin !== 'none' && f.origin !== 'broken') out.push(`  --font-${slug}: ${f.exportStack};`)
    out.push(`  --type-${slug}-size: ${cssSize(typography, role.scaleStep)};`)
    out.push(`  --type-${slug}-weight: ${role.weight};`)
    out.push(`  --type-${slug}-line-height: ${role.lineHeight};`)
    out.push(`  --type-${slug}-letter-spacing: ${role.letterSpacingEm}em;`)
  }
  const extra = typeStyles(project).filter((s) => s.kind !== 'role')
  out.push('', '  /* Heading levels use the first heading role; body sizes use the first body role. */')
  for (const s of extra) out.push(`  --type-${s.id}-size: ${cssSize(typography, s.step)};`)
  out.push('}')

  for (const role of typography.roles) {
    const slug = slugs.get(role.id)!
    const f = resolveRole(project, role)
    out.push('', `.type-${slug} {`)
    out.push(`  font-family: ${f.origin === 'none' || f.origin === 'broken' ? 'inherit' : `var(--font-${slug})`};`)
    out.push(`  font-size: var(--type-${slug}-size);`, `  font-weight: var(--type-${slug}-weight);`, `  line-height: var(--type-${slug}-line-height);`, `  letter-spacing: var(--type-${slug}-letter-spacing);`, '}')
  }
  for (const s of extra) {
    const role = s.role
    const slug = role ? slugs.get(role.id)! : null
    const f = role ? resolveRole(project, role) : null
    out.push('', `.type-${s.id} {`)
    out.push(`  font-family: ${slug && f && f.origin !== 'none' && f.origin !== 'broken' ? `var(--font-${slug})` : 'inherit'};`)
    out.push(`  font-size: var(--type-${s.id}-size);`)
    if (slug) out.push(`  font-weight: var(--type-${slug}-weight);`, `  line-height: var(--type-${slug}-line-height);`, `  letter-spacing: var(--type-${slug}-letter-spacing);`)
    out.push('}')
  }
  return out.join('\n') + '\n'
}

export { quoteFamily }
