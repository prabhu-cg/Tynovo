import type { CSSProperties } from 'react'
import type { Project, RoleKind, TypographyRole } from '@/modules/brand-projects/schema'
import { styleSizeAt, typeStyles, type TypeStyle } from '@/modules/typography-system/tokens'
import { brandName } from './brand'
import { missingChars } from './fit'
import { resolveRole } from './fonts'

/**
 * The text of the brand application previews. Previews render from these slots, and the missing-character
 * warning is computed from the same slots, so the warning always describes exactly what is on screen.
 * The default copy is plain ASCII on purpose: a warning should come from the user's own words (a brand name
 * with an accent, say), not from our sample text.
 */

export interface PreviewCopy {
  headline: string
  subhead: string
  body: string
  caption: string
  action: string
  /** Several paragraphs, separated by blank lines. */
  longform: string
}

export function defaultCopy(project: Pick<Project, 'name' | 'brand'>): PreviewCopy {
  const trait = project.brand.personality[0]
  return {
    headline: trait ? `Typography that feels ${trait}` : 'Letters with a point of view',
    subhead: `A typographic system for ${brandName(project)}`,
    body: 'Good typography is invisible until it is wrong. This paragraph shows how running text reads, with numbers like 1,024.50, brackets (like these) and a question: does it hold up?',
    caption: 'Updated 12 March 2026 - 4 min read',
    action: 'Get started',
    longform:
      'Every word on a page is set in a typeface someone chose on purpose. When the choice is right, nobody notices it; the reader simply gets to the end of the paragraph without effort.\n\nA long text is where a type system is tested. Line length, line height and the size of the text decide whether a column feels calm or tiring, and no single sample can show that. Read this passage at the size your readers will, on the surface they will use.\n\nNumbers help too: 12 seats, 3 plans, 99.9% uptime, 2,048 users. Punctuation, such as quotes, (brackets) and a long clause - with a dash - should look as considered as the letters do.',
  }
}

/** The copy the previews and the specimen use: Tynovo's defaults, overridden by what the person saved. */
export const effectiveCopy = (project: Pick<Project, 'name' | 'brand'>): PreviewCopy => ({ ...defaultCopy(project), ...project.brand.sampleCopy }) as PreviewCopy

export const APPLICATIONS = [
  { id: 'website', label: 'Website' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'product', label: 'Product interface' },
  { id: 'poster', label: 'Poster' },
  { id: 'document', label: 'Printed document' },
] as const
export type ApplicationId = (typeof APPLICATIONS)[number]['id']

/** Which style a piece of text is set in: a role kind (first role of that kind), a heading level or a body size. */
export type SlotStyle = RoleKind | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body-lg' | 'body-sm'

export interface Slot {
  id: string
  style: SlotStyle
  text: string
}

export function applicationSlots(project: Pick<Project, 'name' | 'brand'>, copy: PreviewCopy, app: ApplicationId): Slot[] {
  const s = (id: string, style: SlotStyle, text: string): Slot => ({ id, style, text })
  const brand = brandName(project)
  switch (app) {
    case 'website':
      return [
        s('brand', 'heading', brand),
        s('nav-1', 'ui', 'Work'),
        s('nav-2', 'ui', 'Journal'),
        s('nav-3', 'ui', 'Contact'),
        s('headline', 'display', copy.headline),
        s('subhead', 'h3', copy.subhead),
        s('body', 'body', copy.body),
        s('action', 'ui', copy.action),
        s('article-title', 'h4', 'How we choose our letters'),
        s('article-body', 'body-sm', 'Every word on a page is set in a typeface someone chose on purpose.'),
        s('caption', 'caption', copy.caption),
      ]
    case 'editorial': {
      const [first = '', ...rest] = copy.longform.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      return [
        s('kicker', 'ui', brand),
        s('title', 'h1', copy.headline),
        s('deck', 'body-lg', copy.subhead),
        s('byline', 'caption', copy.caption),
        s('p-0', 'body', first),
        s('h2', 'h2', 'Reading at length'),
        ...rest.slice(0, 4).map((p, i) => s(`p-${i + 1}`, 'body', p)),
        s('h3', 'h3', 'Small print and numbers'),
        s('note', 'body-sm', 'Figures 1-3 show the type scale at three sizes (see the note below).'),
      ]
    }
    case 'product':
      return [
        s('title', 'h3', 'Account settings'),
        s('lede', 'body', copy.body),
        s('label-email', 'ui', 'Email address'),
        s('value-email', 'body', 'name@example.com'),
        s('label-plan', 'ui', 'Plan'),
        s('value-plan', 'body', 'Studio - 12 seats'),
        s('row-1', 'ui', 'Invoice 1,024.50 USD'),
        s('row-2', 'caption', 'Tax 20% / VAT +204.90'),
        s('action', 'ui', 'Save changes'),
        s('caption', 'caption', copy.caption),
      ]
    case 'poster':
      return [
        s('brand', 'ui', brand),
        s('headline', 'display', copy.headline),
        s('subhead', 'h3', copy.subhead),
        s('caption', 'caption', copy.caption),
      ]
    case 'document': {
      // A report or letter on paper: letterhead, title block, running text with headings, a table of figures, a footnote, a footer.
      const [first = '', second = ''] = copy.longform.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      return [
        s('letterhead', 'heading', brand),
        s('letterhead-meta', 'caption', copy.caption),
        s('title', 'h1', copy.headline),
        s('deck', 'body-lg', copy.subhead),
        s('p-0', 'body', first),
        s('h2', 'h2', 'Summary of work'),
        s('p-1', 'body', second || copy.body),
        s('th-item', 'ui', 'Item'),
        s('th-qty', 'ui', 'Qty'),
        s('th-amount', 'ui', 'Amount (USD)'),
        s('td-1', 'body-sm', 'Type system review'),
        s('td-1-qty', 'body-sm', '1'),
        s('td-1-amount', 'body-sm', '1,200.00'),
        s('td-2', 'body-sm', 'Specimen pages'),
        s('td-2-qty', 'body-sm', '12'),
        s('td-2-amount', 'body-sm', '840.50'),
        s('total-label', 'ui', 'Total'),
        s('total-amount', 'ui', '2,040.50'),
        s('note', 'body-sm', 'Amounts exclude tax. Figures are examples set to show tables of numbers in print.'),
        s('footer', 'caption', `${brand} - page 1 of 1`),
      ]
    }
  }
}

/** The style a slot is set in, or null when the project has no role to take it from. */
export function styleForSlot(project: Pick<Project, 'typography'>, style: SlotStyle): TypeStyle | null {
  const styles = typeStyles(project)
  const hit = styles.find((t) => (t.kind === 'role' ? t.roleKind === style : t.id === style))
  return hit && hit.role ? hit : null
}

/** First role of a kind. Roles are the user's, so there may be none, or several. */
export const roleForKind = (project: Pick<Project, 'typography'>, kind: RoleKind): TypographyRole | undefined => project.typography.roles.find((r) => r.kind === kind)

export interface RoleMissing {
  role: TypographyRole
  /** Distinct characters shown in this role that the typeface cannot draw. */
  chars: string[]
  /** The preview texts they appear in. */
  samples: string[]
}

/** For each role set in the project's own typeface: the characters its preview text needs and the typeface lacks. */
export function previewMissing(project: Project, slots: readonly Slot[]): RoleMissing[] {
  const face = project.customTypeface
  if (!face) return []
  const out = new Map<string, RoleMissing>()
  for (const slot of slots) {
    const role = styleForSlot(project, slot.style)?.role
    if (!role || resolveRole(project, role).origin !== 'custom') continue
    const chars = missingChars(face, slot.text)
    if (chars.length === 0) continue
    const entry = out.get(role.id) ?? { role, chars: [], samples: [] }
    for (const c of chars) if (!entry.chars.includes(c)) entry.chars.push(c)
    entry.samples.push(slot.text)
    out.set(role.id, entry)
  }
  return [...out.values()]
}

/**
 * Inline style for text set in a style: font, weight, size at the given viewport width, line height and letter
 * spacing. Sizes come from the same scale and responsive settings the exported CSS is built from.
 */
export function styleProps(project: Project, style: TypeStyle | null, viewportPx: number): CSSProperties {
  if (!style?.role) return {}
  return {
    fontFamily: resolveRole(project, style.role).previewStack,
    fontWeight: style.role.weight,
    fontSize: styleSizeAt(project, style, viewportPx),
    lineHeight: style.role.lineHeight,
    letterSpacing: `${style.role.letterSpacingEm}em`,
  }
}
