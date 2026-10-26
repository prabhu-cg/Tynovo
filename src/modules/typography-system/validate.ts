import type { Project } from '@/modules/brand-projects/schema'
import { sizeSpec } from './scale'

/**
 * Plain-language checks on the numbers of a type system, for values that are allowed but unlikely to be intended.
 * The editor already refuses values outside hard limits (see the schema); these are the "legal but impractical" ones.
 * They are rules of thumb: none of them is a legibility or accessibility test.
 */
export interface TypographyIssue {
  id: string
  /** Where to fix it. */
  field: 'scale' | 'responsive' | 'role' | 'sizes'
  roleId?: string
  message: string
}

const px = (n: number) => `${Math.round(n * 10) / 10}px`

export function typographyIssues(project: Pick<Project, 'typography'>): TypographyIssue[] {
  const out: TypographyIssue[] = []
  const { scale, responsive, roles, sizes } = project.typography
  const add = (i: TypographyIssue) => out.push(i)

  if (scale.baseSizePx < 12) add({ id: 'scale.base-small', field: 'scale', message: `A base size of ${px(scale.baseSizePx)} is small for running text; most systems start at 14px or more.` })
  if (scale.baseSizePx > 24) add({ id: 'scale.base-large', field: 'scale', message: `A base size of ${px(scale.baseSizePx)} is large for running text; check that body copy is not oversized.` })
  if (scale.ratio > 1.6) add({ id: 'scale.ratio-large', field: 'scale', message: `A ratio of ${scale.ratio} makes each step much larger than the last; the top of the scale may not fit on a screen.` })
  if (scale.ratio < 1.05 && scale.ratio > 1) add({ id: 'scale.ratio-small', field: 'scale', message: `A ratio of ${scale.ratio} barely separates the steps, so sizes will look alike.` })
  if (scale.ratio === 1) add({ id: 'scale.flat', field: 'scale', message: 'A ratio of 1 makes every step the same size.' })

  if (responsive.enabled) {
    if (responsive.minBaseSizePx > scale.baseSizePx) add({ id: 'responsive.inverted', field: 'responsive', message: `The small-screen base (${px(responsive.minBaseSizePx)}) is larger than the main base (${px(scale.baseSizePx)}), so text would shrink as the screen grows.` })
    if (responsive.minBaseSizePx < 12) add({ id: 'responsive.small', field: 'responsive', message: `A small-screen base of ${px(responsive.minBaseSizePx)} is small for running text.` })
  }

  for (const r of roles) {
    const size = sizeSpec(project.typography, r.scaleStep)
    const smallest = Math.min(size.minPx, size.maxPx)
    const where = (m: string): TypographyIssue => ({ id: `role.${r.id}.${m}`, field: 'role', roleId: r.id, message: '' })
    if (r.kind === 'body' && smallest < 14) add({ ...where('size'), message: `${r.name} is ${px(smallest)} at its smallest; body text under 14px is hard to read for many people.` })
    if ((r.kind === 'ui' || r.kind === 'caption') && smallest < 11) add({ ...where('size'), message: `${r.name} is ${px(smallest)} at its smallest; text under 11px is hard to read.` })
    if (r.kind === 'body' && r.lineHeight < 1.3) add({ ...where('lh'), message: `${r.name} has a line height of ${r.lineHeight}; running text usually needs 1.4 or more.` })
    if (r.kind === 'body' && r.lineHeight > 1.9) add({ ...where('lh'), message: `${r.name} has a line height of ${r.lineHeight}; lines this far apart stop reading as a paragraph.` })
    if (r.kind === 'heading' && r.lineHeight > 1.5) add({ ...where('lh'), message: `${r.name} has a line height of ${r.lineHeight}; headings are usually set tighter (1.1 to 1.3).` })
    if (r.kind === 'display' && r.lineHeight > 1.3) add({ ...where('lh'), message: `${r.name} has a line height of ${r.lineHeight}; large type is usually set tighter (about 1.0 to 1.2).` })
    if ((r.kind === 'body' || r.kind === 'ui' || r.kind === 'caption') && Math.abs(r.letterSpacingEm) > 0.05) add({ ...where('ls'), message: `${r.name} has ${r.letterSpacingEm}em of letter spacing; for small text more than ±0.05em hurts reading.` })
    if (r.kind === 'display' && r.letterSpacingEm < -0.05) add({ ...where('ls'), message: `${r.name} has ${r.letterSpacingEm}em of letter spacing; letters this tight may touch.` })
    if (r.weight < 300 && (r.kind === 'body' || r.kind === 'ui' || r.kind === 'caption')) add({ ...where('weight'), message: `${r.name} uses weight ${r.weight}; very light text loses contrast at small sizes.` })
  }

  const byKind = (k: string) => roles.find((r) => r.kind === k)
  const display = byKind('display')
  const heading = byKind('heading')
  const body = byKind('body')
  if (display && heading && display.scaleStep < heading.scaleStep) add({ id: 'sizes.display-below-heading', field: 'role', roleId: display.id, message: `${display.name} is smaller than ${heading.name} on the scale.` })
  if (heading && body && heading.scaleStep < body.scaleStep) add({ id: 'sizes.heading-below-body', field: 'role', roleId: heading.id, message: `${heading.name} is smaller than ${body.name} on the scale.` })
  for (let i = 1; i < 6; i++) {
    if (sizes.headings[i]! > sizes.headings[i - 1]!) {
      add({ id: `sizes.h${i + 1}-above-h${i}`, field: 'sizes', message: `Heading ${i + 1} is larger than Heading ${i}.` })
    }
  }
  if (body && sizes.bodySmall > body.scaleStep) add({ id: 'sizes.body-small', field: 'sizes', message: 'Body small is larger than the body size.' })
  if (body && sizes.bodyLarge < body.scaleStep) add({ id: 'sizes.body-large', field: 'sizes', message: 'Body large is smaller than the body size.' })
  return out
}
