import { brandName } from '@/modules/brand-system/brand'
import { fontsInUse, ORIGIN_LABEL, resolveRole, type ResolvedFont } from '@/modules/brand-system/fonts'
import { effectiveCopy } from '@/modules/brand-system/preview'
import { catalogFontFor, type CatalogFont } from '@/modules/font-catalog/catalog'
import { nearestWeight } from '@/modules/font-catalog/loader'
import { typeStyles } from '@/modules/typography-system/tokens'
import { computeScale, sizeForStep } from '@/modules/typography-system/scale'
import type { TypographyRole } from '@/modules/brand-projects/schema'
import { TARGET_CHARS } from '@/modules/typeface-engine/charset'
import { helveticaFont, type StandardFont } from './pdf-kit/helvetica'
import { parseTrueType } from './pdf-kit/sfnt'
import { woffToSfnt } from './pdf-kit/woff'
import { EmbeddedFont, PdfDocument, type Page, type Rgb } from './pdf-kit/writer'
import type { ExportInput } from './types'

/** Returns the bytes of a bundled catalog font file (WOFF), or rejects. Injected so the generator needs no browser. */
export type CatalogFileLoader = (id: string, weight: number) => Promise<Uint8Array>

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 54
const WIDTH = A4[0] - MARGIN * 2
const INK: Rgb = [0.13, 0.13, 0.13]
const SOFT: Rgb = [0.4, 0.4, 0.4]
const RULE: Rgb = [0.85, 0.85, 0.85]
const PX = 0.75 // CSS px to PDF points
/** The largest sample, in CSS px, so one huge role does not push everything else off the page. */
const MAX_SAMPLE_PX = 80

/** A font the PDF can draw with. */
type Face = StandardFont | EmbeddedFont

interface Run {
  text: string
  face: Face
}

const pt = (px: number) => px * PX

/** A short, stable tag so the embedded font names, and so the whole file, are the same for the same project. */
function tagFor(seed: string): string {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.codePointAt(0)!, 16777619) >>> 0
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += String.fromCharCode(65 + (h % 26))
    h = Math.floor(h / 26) + (i + 1) * 7919
  }
  return out
}

/**
 * A specimen as a PDF: the scale, every role set in its font, the heading levels, the custom typeface's character
 * set and where every font comes from. Text is real text (selectable, searchable) and the fonts it uses are embedded:
 * the custom typeface in full, and the bundled catalog fonts as the Latin files Tynovo ships (they are under the SIL Open Font
 * License, which allows embedding in a document). A font Tynovo does not have a file for (one named by the user, installed on their
 * device) cannot be embedded; the PDF draws it in Helvetica and says so beside the sample.
 */
export async function buildSpecimenPdf(input: ExportInput, loadCatalogFile: CatalogFileLoader): Promise<Uint8Array> {
  const { project, revision, font: customFont } = input
  const doc = new PdfDocument(A4)
  const helvetica = helveticaFont(false)
  const helveticaBold = helveticaFont(true)

  /* ----- fonts for the roles ----- */
  interface RoleFace {
    face: Face
    /** Why this is not the role's own font; empty when it is. */
    note: string
  }
  const cache = new Map<string, Promise<EmbeddedFont | null>>()
  /** Loads a font file (a WOFF from the catalog, or the custom typeface's TTF) and embeds it; null when it cannot be used. */
  const embed = (key: string, load: () => Promise<Uint8Array>, name: string, isWoff: boolean): Promise<EmbeddedFont | null> => {
    let p = cache.get(key)
    if (!p) {
      p = load()
        .then(async (bytes) => {
          const sfnt = isWoff ? await woffToSfnt(bytes) : bytes
          return new EmbeddedFont(`${tagFor(key)}+${name.replace(/[^A-Za-z0-9-]/g, '') || 'Font'}`, sfnt, parseTrueType(sfnt))
        })
        .catch(() => null)
      cache.set(key, p)
    }
    return p
  }

  const faceForRole = async (role: TypographyRole, resolved: ResolvedFont): Promise<RoleFace> => {
    const fallback = (note: string): RoleFace => ({ face: role.weight >= 600 ? helveticaBold : helvetica, note })
    if (resolved.origin === 'none') return fallback('No font is assigned to this role.')
    if (resolved.origin === 'broken') return fallback('The font assigned to this role is missing from the project.')
    if (resolved.origin === 'custom') {
      if (!customFont) return fallback('The custom typeface has no font file, so Helvetica is shown.')
      const f = await embed('custom', async () => customFont.bytes, resolved.family, false)
      if (!f) return fallback('The custom typeface file could not be read, so Helvetica is shown.')
      return { face: f, note: role.weight !== 400 ? 'The custom typeface has one style (regular); this role asks for a different weight, which the PDF does not imitate.' : '' }
    }
    const cat: CatalogFont | undefined = resolved.source?.kind === 'catalog' ? catalogFontFor(resolved.source.family) : undefined
    if (!cat) return fallback(`${resolved.family} is not bundled with Tynovo, so it cannot be embedded; Helvetica is shown. It draws correctly only where the font is installed.`)
    const weight = nearestWeight(cat.weights, role.weight)
    const f = await embed(`${cat.id}|${weight}`, () => loadCatalogFile(cat.id, weight), cat.family, true)
    if (!f) return fallback(`The ${cat.family} file could not be loaded here, so Helvetica is shown.`)
    return { face: f, note: weight !== role.weight ? `${cat.family} has no ${role.weight} weight; ${weight} is shown, as a browser would.` : '' }
  }

  const roleFaces = new Map<string, RoleFace>()
  for (const role of project.typography.roles) roleFaces.set(role.id, await faceForRole(role, resolveRole(project, role)))
  const firstRoleFace = (kind: TypographyRole['kind']): RoleFace | undefined => {
    const r = project.typography.roles.find((x) => x.kind === kind)
    return r ? roleFaces.get(r.id) : undefined
  }

  /* ----- text layout ----- */
  const runsOf = (text: string, face: Face): Run[] => {
    const runs: Run[] = []
    for (const ch of text) {
      const cp = ch.codePointAt(0)!
      const useFace = face.has(cp) ? face : helvetica.has(cp) ? helvetica : null
      const run: Run = useFace ? { text: ch, face: useFace } : { text: '?', face: helvetica }
      const last = runs[runs.length - 1]
      if (last && last.face === run.face) last.text += run.text
      else runs.push(run)
    }
    return runs
  }
  const widthOf = (runs: Run[], size: number, spacing: number) => runs.reduce((w, r) => w + r.face.width(r.text, size) + spacing * [...r.text].length, 0)
  const measure = (text: string, face: Face, size: number, spacing: number) => widthOf(runsOf(text, face), size, spacing)

  const wrap = (text: string, face: Face, size: number, spacing: number, maxWidth: number): string[] => {
    const lines: string[] = []
    for (const paragraph of text.split('\n')) {
      let line = ''
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word
        if (line && measure(candidate, face, size, spacing) > maxWidth) {
          lines.push(line)
          line = word
        } else line = candidate
      }
      lines.push(line)
    }
    return lines
  }

  let page!: Page
  let y = 0
  const pages: Page[] = []
  const newPage = () => {
    page = doc.addPage()
    pages.push(page)
    y = A4[1] - MARGIN
  }
  const need = (height: number) => {
    if (y - height < MARGIN + 24) newPage()
  }

  const drawRuns = (runs: Run[], x: number, baseline: number, size: number, spacing: number, color: Rgb = INK) => {
    let cx = x
    for (const r of runs) {
      page.text(r.text, { x: cx, y: baseline, size, font: r.face, color, spacing })
      cx += r.face.width(r.text, size) + spacing * [...r.text].length
    }
  }

  const label = (text: string, size = 8, color = SOFT, bold = false, x = MARGIN) => {
    const face = bold ? helveticaBold : helvetica
    need(size * 1.5)
    y -= size * 1.2
    drawRuns(runsOf(text, face), x, y, size, 0, color)
    y -= size * 0.3
  }
  const wrappedLabel = (text: string, size = 8, color = SOFT) => {
    for (const line of wrap(text, helvetica, size, 0, WIDTH)) label(line, size, color)
  }
  const heading = (text: string) => {
    need(110) // a heading is never left alone at the foot of a page
    y -= 26
    page.line(MARGIN, y, A4[0] - MARGIN, y, { width: 0.5, color: RULE })
    y -= 8
    label(text, 13, INK, true)
    y -= 6
  }

  /** Text in a role's font, wrapped to the page, at a size in CSS px. */
  const sample = (text: string, rf: RoleFace, px: number, lineHeight: number, spacingEm: number) => {
    const size = pt(Math.min(px, MAX_SAMPLE_PX))
    const spacing = spacingEm * size
    for (const line of wrap(text, rf.face, size, spacing, WIDTH)) {
      const step = size * lineHeight
      need(step)
      y -= step
      drawRuns(runsOf(line, rf.face), MARGIN, y + (step - size) / 2 + size * 0.12, size, spacing)
    }
  }

  /* ----- pages ----- */
  newPage()
  const copy = effectiveCopy(project)

  const displayFace = firstRoleFace('display') ?? firstRoleFace('heading')
  const name = brandName(project)
  y -= 72
  const nameSize = 44
  const nameFace = displayFace?.face ?? helveticaBold
  for (const line of wrap(name, nameFace, nameSize, 0, WIDTH)) {
    y -= nameSize * 1.1
    drawRuns(runsOf(line, nameFace), MARGIN, y, nameSize, 0)
  }
  y -= 8
  label('Typography specimen', 14, SOFT, false)
  y -= 14
  if (project.brand.description.trim()) for (const line of wrap(project.brand.description.trim(), helvetica, 10.5, 0, WIDTH)) label(line, 10.5, INK)
  y -= 18
  const { scale } = project.typography
  const uses = fontsInUse(project)
  const facts: Array<[string, string]> = [
    ['Base size', `${scale.baseSizePx}px`],
    ['Scale ratio', String(scale.ratio)],
    ['Roles', project.typography.roles.map((r) => r.name).join(', ')],
    ['Fonts', uses.length ? uses.map((u) => u.font.family).join(', ') : 'none assigned'],
    ['Project revision', revision],
    ['Generated', input.generatedAt],
  ]
  for (const [k, v] of facts) {
    const lines = wrap(v, helvetica, 9.5, 0, WIDTH - 110)
    need(lines.length * 13 + 4)
    y -= 13
    drawRuns(runsOf(k, helveticaBold), MARGIN, y, 9.5, 0, SOFT)
    lines.forEach((l, i) => {
      if (i > 0) y -= 13
      drawRuns(runsOf(l, helvetica), MARGIN + 110, y, 9.5, 0)
    })
  }

  heading('Roles')
  for (const role of project.typography.roles) {
    const resolved = resolveRole(project, role)
    const rf = roleFaces.get(role.id)!
    need(70)
    label(role.name, 10, INK, true)
    const family = resolved.origin === 'none' || resolved.origin === 'broken' ? ORIGIN_LABEL[resolved.origin] : `${resolved.family}, ${ORIGIN_LABEL[resolved.origin]}`
    label(`${family} · ${sizeForStep(scale, role.scaleStep)}px / weight ${role.weight} / line height ${role.lineHeight} / letter spacing ${role.letterSpacingEm}em`)
    y -= 4
    const text = role.kind === 'display' ? copy.headline : role.kind === 'heading' ? copy.subhead : role.kind === 'ui' ? copy.caption : copy.body
    sample(text, rf, sizeForStep(scale, role.scaleStep), role.lineHeight, role.letterSpacingEm)
    if (rf.note) {
      y -= 2
      wrappedLabel(`Note: ${rf.note}`, 7.5)
    }
    y -= 10
    page.line(MARGIN, y, A4[0] - MARGIN, y, { width: 0.3, color: RULE })
    y -= 12
  }

  const levels = typeStyles(project).filter((t) => t.kind !== 'role')
  if (levels.length > 0) {
    heading('Heading and body levels')
    for (const t of levels) {
      const rf = (t.role ? roleFaces.get(t.role.id) : undefined) ?? { face: helvetica, note: '' }
      const px = sizeForStep(scale, t.step)
      need(pt(Math.min(px, MAX_SAMPLE_PX)) * 1.4 + 24)
      label(`${t.label} · step ${t.step} · ${px}px`)
      sample(t.kind === 'level' ? 'Headline set in the heading role' : 'Body text set in the body role', rf, px, t.role?.lineHeight ?? 1.3, t.role?.letterSpacingEm ?? 0)
      y -= 4
    }
  }

  heading('Type scale')
  const scaleFace = firstRoleFace('heading') ?? firstRoleFace('body') ?? { face: helvetica, note: '' }
  for (const s of [...computeScale(scale)].reverse()) {
    const size = pt(Math.min(s.sizePx, MAX_SAMPLE_PX))
    need(size * 1.3 + 14)
    label(`Step ${s.step} · ${s.sizePx}px`)
    y -= size * 1.05
    drawRuns(runsOf('Hamburgefonstiv', scaleFace.face), MARGIN, y, size, 0)
    y -= 12
  }

  if (customFont) {
    const cf = await embed('custom', async () => customFont.bytes, project.customTypeface?.familyName ?? 'Custom', false)
    if (cf) {
      heading('Character set')
      label(`${project.customTypeface?.familyName ?? 'Custom typeface'} · ${customFont.format.toUpperCase()} · ${TARGET_CHARS.length} target characters, Latin only`)
      y -= 6
      const cell = 36
      const perRow = Math.floor(WIDTH / cell)
      const size = 24
      let col = 0
      for (const ch of TARGET_CHARS) {
        if (col === 0) {
          need(cell)
          y -= cell
        }
        if (ch !== ' ' && cf.has(ch.codePointAt(0)!)) page.text(ch, { x: MARGIN + col * cell + (cell - cf.width(ch, size)) / 2, y: y + 8, size, font: cf, color: INK })
        col = (col + 1) % perRow
      }
      y -= 8
    }
  }

  heading('Fonts and licences')
  if (uses.length === 0) wrappedLabel('No fonts are assigned to roles.', 9, INK)
  for (const u of uses) {
    const f = u.font
    const cat = f.source?.kind === 'catalog' ? catalogFontFor(f.source.family) : undefined
    const status =
      f.origin === 'custom'
        ? customFont
          ? 'embedded in this PDF'
          : 'font file unavailable'
        : cat
          ? `embedded in this PDF, as the SIL Open Font License permits for documents; the font files themselves are not part of this export. Source: ${cat.distribution}`
          : 'not embedded; renders only where installed'
    const lic = f.license ? `${f.license.name}${f.license.verified ? '' : ' (not verified)'}` : 'licence not recorded'
    label(f.family, 9.5, INK, true)
    wrappedLabel(`${ORIGIN_LABEL[f.origin]} · ${status} · Licence: ${lic}.`, 8.5)
    y -= 6
  }
  y -= 10
  wrappedLabel('Licences are recorded, never verified or invented. This is not legal advice: check that each font’s licence allows your use.', 8)

  /* ----- footer on every page ----- */
  pages.forEach((p, i) => {
    const text = `Tynovo · ${name} · revision ${revision} · page ${i + 1} of ${pages.length}`
    page = p
    drawRuns(runsOf(text, helvetica), MARGIN, MARGIN - 18, 7, 0, SOFT)
  })

  return doc.save({
    title: `${name} - typography specimen`,
    producer: 'Tynovo',
    creator: `Tynovo, project revision ${revision}`,
    subject: `Typography specimen, project revision ${revision}`,
    created: new Date(input.generatedAt),
  })
}
