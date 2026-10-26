import { catalogFontFor } from '@/modules/font-catalog/catalog'
import { applicationSlots, effectiveCopy } from '@/modules/brand-system/preview'
import { brandName } from '@/modules/brand-system/brand'
import { typeStyles } from '@/modules/typography-system/tokens'
import { fontsInUse, ORIGIN_LABEL, resolveRole, roleSlugs } from '@/modules/brand-system/fonts'
import { escapeHtml } from '@/modules/brand-system/text'
import { computeScale, sizeForStep } from '@/modules/typography-system/scale'
import { buildCss } from './css'
import type { ExportInput } from './types'

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/**
 * A single self-contained HTML page: scale, every role set in its font, and a short sample. The custom typeface
 * is embedded so the page looks right anywhere; existing fonts are only named, and the page says which of them
 * the viewer needs to have.
 */
export function buildSpecimen(input: ExportInput): string {
  const { project, revision, font } = input
  const slugs = roleSlugs(project.typography.roles)
  const embedded = font ? `data:${font.mimeType};base64,${toBase64(font.bytes)}` : undefined
  // '<' can only come from user text (names, comments); escape it so nothing inside <style> can look like markup.
  const css = buildCss(input, embedded ? { fontUrl: embedded } : {}).replace(/</g, '\\3c ')
  const copy = effectiveCopy(project)
  const slots = applicationSlots(project, copy, 'website')
  const text = (id: string) => escapeHtml(slots.find((s) => s.id === id)?.text ?? '')
  const roleClass = (kind: string) => {
    const r = project.typography.roles.find((x) => x.kind === kind)
    return r ? `type-${slugs.get(r.id)}` : ''
  }
  const uses = fontsInUse(project)
  const missingExternal = uses.filter((u) => u.font.origin !== 'custom')

  const roleRows = project.typography.roles
    .map((r) => {
      const f = resolveRole(project, r)
      const slug = slugs.get(r.id)!
      return `<section class="role"><h3>${escapeHtml(r.name)}</h3><p class="meta">${escapeHtml(f.origin === 'none' || f.origin === 'broken' ? ORIGIN_LABEL[f.origin] : `${f.family} - ${ORIGIN_LABEL[f.origin]}`)} - ${sizeForStep(project.typography.scale, r.scaleStep)}px / ${r.weight} / ${r.lineHeight} / ${r.letterSpacingEm}em</p><p class="type-${slug} sample">${escapeHtml(r.kind === 'display' ? copy.headline : r.kind === 'heading' ? copy.subhead : r.kind === 'ui' ? copy.caption : copy.body)}</p></section>`
    })
    .join('\n')
  const levels = typeStyles(project)
    .filter((t) => t.kind !== 'role')
    .map((t) => `<li><span class="meta">${escapeHtml(t.label)} - step ${t.step}</span><span class="type-${t.id}" style="white-space:nowrap">${escapeHtml(t.kind === 'level' ? 'Headline set in the heading role' : 'Body text set in the body role')}</span></li>`)
    .join('\n')
  const scaleRows = [...computeScale(project.typography.scale)]
    .reverse()
    .map((s) => `<li><span class="meta">Step ${s.step} - ${s.sizePx}px</span><span style="font-size:${Math.min(s.sizePx, 72)}px">Hamburgefonstiv</span></li>`)
    .join('\n')
  const fontNotes = uses
    .map((u) => {
      const cat = u.font.source?.kind === 'catalog' ? catalogFontFor(u.font.source.family) : undefined
      const status = u.font.origin === 'custom' ? (font ? 'embedded in this page' : 'font file unavailable, fallback shown') : `not included${cat ? `; get it from the ${escapeHtml(cat.distribution)} package` : '; renders only where installed'}`
      const lic = u.font.license ? `${escapeHtml(u.font.license.name)}${u.font.license.verified ? '' : ' (not verified)'}` : 'licence not recorded'
      return `<li><strong>${escapeHtml(u.font.family)}</strong> - ${ORIGIN_LABEL[u.font.origin]}, ${status}. Licence: ${lic}.</li>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Brand Typography Studio, project revision ${revision}">
<title>${escapeHtml(brandName(project))} - typography specimen</title>
<style>
${css}
body { margin: 0; padding: 2rem 1rem 4rem; font: 16px/1.5 system-ui, sans-serif; color: #444; background: #fff; }
main { max-width: 56rem; margin: 0 auto; }
h1 { font-size: 1.75rem; margin: 0 0 .25rem; color: #222; }
h2 { font-size: 1.1rem; margin: 3rem 0 1rem; color: #222; border-top: 1px solid #ddd; padding-top: 1.5rem; }
h3 { font: 700 .95rem/1.2 system-ui, sans-serif; margin: 0; color: #222; }
.meta { font: .8rem/1.4 system-ui, sans-serif; color: #666; margin: .15rem 0 .5rem; }
.role { padding: 1rem 0; border-bottom: 1px solid #eee; }
.sample { margin: 0; overflow-wrap: anywhere; }
ul.scale { list-style: none; padding: 0; margin: 0; }
ul.scale li { display: flex; align-items: baseline; gap: 1rem; padding: .35rem 0; border-bottom: 1px solid #eee; overflow: hidden; white-space: nowrap; }
ul.scale .meta { width: 9rem; flex: none; margin: 0; }
.notice { background: #fdf6e3; border: 1px solid #e0c27a; color: #5c3d00; padding: .75rem 1rem; border-radius: 6px; font: .9rem/1.5 system-ui, sans-serif; }
.fonts { font: .9rem/1.5 system-ui, sans-serif; padding-left: 1.25rem; }
@media print { body { padding: 0; } main { max-width: none; } h2 { break-after: avoid; } .role, ul.scale li { break-inside: avoid; } }
.page { margin-top: 1rem; padding: 1.5rem; border: 1px solid #ddd; border-radius: 6px; }
.page .brand { margin: 0 0 1rem; }
.page p { margin: 0 0 .75rem; }
</style>
</head>
<body>
<main>
<h1>${escapeHtml(brandName(project))}</h1>
<p class="meta">Typography specimen - project revision ${revision} - generated ${escapeHtml(input.generatedAt)}</p>
${missingExternal.length > 0 ? `<p class="notice">This page names ${missingExternal.map((u) => escapeHtml(u.font.family)).join(', ')}, which ${missingExternal.length === 1 ? 'is' : 'are'} not included. Where ${missingExternal.length === 1 ? 'it is' : 'they are'} not installed, your browser shows a fallback font instead.</p>` : ''}
<h2>Roles</h2>
${roleRows}
<h2>Sample page</h2>
<div class="page">
<p class="brand ${roleClass('heading')}">${text('brand')}</p>
<p class="${roleClass('display')}">${text('headline')}</p>
<p class="${roleClass('body')}">${text('body')}</p>
</div>
<h2>Heading and body sizes</h2>
<ul class="scale">
${levels}
</ul>
<h2>Type scale</h2>
<ul class="scale">
${scaleRows}
</ul>
<h2>Fonts and licences</h2>
${uses.length === 0 ? '<p class="meta">No fonts are assigned to roles.</p>' : `<ul class="fonts">\n${fontNotes}\n</ul>`}
</main>
</body>
</html>
`
}
