import { catalogFontFor } from '@/modules/font-catalog/catalog'
import { brandName } from '@/modules/brand-system/brand'
import { fontsInUse, ORIGIN_LABEL } from '@/modules/brand-system/fonts'
import { mdInline } from '@/modules/brand-system/text'
import { LICENSE_PLACEHOLDER } from '@/modules/typeface-engine/typeface'
import { fontPath } from './css'
import type { ExportInput } from './types'

const licenseLabel = (l: { name: string; spdx?: string | undefined }) =>
  `${l.name === LICENSE_PLACEHOLDER ? 'none chosen' : mdInline(l.name)}${l.spdx ? ` (${mdInline(l.spdx)})` : ''}`

export interface ManifestFile {
  path: string
  bytes: number
  sha256: string
}

/**
 * Where every font in the project comes from, what licence it is under, and whether its file is in this export.
 * Licences are recorded, never verified or invented: where nobody confirmed one, the manifest says so.
 */
export function buildManifest(input: ExportInput, files: readonly ManifestFile[]): string {
  const { project, revision, font } = input
  const face = project.customTypeface
  const uses = fontsInUse(project)
  const L: string[] = []
  L.push(`# ${mdInline(brandName(project))}: sources and licences`, '')
  L.push(`Brand Typography Studio, project revision \`${revision}\`, generated ${input.generatedAt}.`, '')
  L.push('This file records where each font comes from and what its licence is, as far as the project knows. It is not legal advice, and it carries no guarantee: check that a font\'s licence allows your use (website, app, print, logo) before you ship it.', '')

  L.push('## Fonts used by roles', '')
  if (uses.length === 0) L.push('No fonts are assigned to roles.', '')
  else {
    L.push('| Font | Roles | Source | Licence | Confirmed | File in this export |', '| --- | --- | --- | --- | --- | --- |')
    for (const u of uses) {
      const f = u.font
      const lic = f.license ? licenseLabel(f.license) : 'not recorded'
      const confirmed = f.license ? (f.license.verified ? 'yes' : 'no') : 'no'
      const inExport = f.origin === 'custom' ? (font ? `\`${fontPath(font.filename)}\`` : 'no (could not be built)') : 'no: supply separately'
      L.push(`| ${mdInline(f.family)} | ${u.roles.map((r) => mdInline(r.name)).join(', ')} | ${ORIGIN_LABEL[f.origin]} | ${lic} | ${confirmed} | ${inExport} |`)
    }
    L.push('')
  }

  if (face) {
    L.push('## Custom typeface', '')
    L.push(`- Name: ${mdInline(face.familyName)} ${mdInline(face.styleName)}`)
    L.push('- Origin: designed in this project from rules and parameters you set. No existing font was copied.')
    L.push(`- Licence chosen by the project owner: ${licenseLabel(face.license)}${face.license.url ? `, ${face.license.url}` : ''}`)
    L.push(`- Licence confirmed by the owner: ${face.license.verified ? 'yes' : 'no'}`)
    L.push(`- Copyright line: ${face.copyright ? mdInline(face.copyright) : 'none set'}`)
    L.push('- The licence of Brand Typography Studio (GPL-3.0-only) is separate from the licence of a font you design with it. The studio does not choose the licence for you.')
    L.push(font ? `- Font file: \`${fontPath(font.filename)}\` (${font.format.toUpperCase()}, SHA-256 \`${font.sha256}\`)` : '- Font file: not produced.')
    L.push('')
  }

  const existing = uses.filter((u) => u.font.origin !== 'custom')
  if (existing.length > 0) {
    L.push('## Existing fonts: not redistributed here', '')
    L.push('No file of a font made by someone else is included in this export. Obtain each from its publisher under its own licence and add it where the CSS expects it.', '')
    for (const u of existing) {
      const cat = u.font.source?.kind === 'catalog' ? catalogFontFor(u.font.source.family) : undefined
      L.push(`- **${mdInline(u.font.family)}**: ${cat ? `distributed as ${cat.distribution} (version ${cat.distributionVersion}), upstream version ${cat.version}; published at ${cat.upstream}; package page ${cat.page}. Copyright: ${mdInline(cat.license.copyright)}. The licence is the one the package metadata declares.` : 'named in the project; the studio has no record of where it comes from.'}${u.font.license?.url ? ` Licence text: ${u.font.license.url}` : ''}`)
    }
    L.push('')
  }

  L.push('## Files in this package', '')
  L.push('| File | Bytes | SHA-256 |', '| --- | ---: | --- |')
  for (const f of files) L.push(`| \`${f.path}\` | ${f.bytes} | \`${f.sha256}\` |`)
  L.push('')
  return L.join('\n')
}
