import { createProject } from '@/modules/brand-projects/model'
import { fakeClock, integratedProject } from '@/modules/testing/factories'
import { createTypeface } from '@/modules/typeface-engine/typeface'
import { assessRoleFit, missingChars, REQUIRED_CHARS, typefaceLimits } from './fit'
import { fontsInUse, previewFamilyName, resolveFont, resolveRole, roleSlugs, rolesUsingCustom } from './fonts'
import { addCatalogFont, addNamedFont, assignCustomTypeface, assignSource, removeCustomTypeface, removeFontSource, updateRole } from './ops'
import { applicationSlots, defaultCopy, previewMissing } from './preview'
import { assessProject, countLevels } from './readiness'
import { canonicalJson, contentRevision } from './revision'
import { cssString, escapeHtml, mdInline } from './text'
import { workflowSteps } from './workflow'
import { sizeForStep } from '@/modules/typography-system/scale'

describe('role fonts: existing and custom stay distinguishable', () => {
  it('resolves each kind of link to its own origin', () => {
    const p = integratedProject()
    const [display, , body, ui] = p.typography.roles
    expect(resolveRole(p, display!).origin).toBe('custom')
    expect(resolveRole(p, body!).origin).toBe('catalog')
    expect(resolveRole(p, ui!).origin).toBe('system')
    expect(resolveFont(p, null).origin).toBe('none')
  })

  it('uses a registered preview name for the custom typeface but its real name for exports', () => {
    const p = integratedProject()
    const f = resolveRole(p, p.typography.roles[0]!)
    expect(f.previewStack).toContain(previewFamilyName(p.customTypeface!))
    expect(f.previewStack).not.toContain('Northwind Sans')
    expect(f.exportStack).toBe('"Northwind Sans", sans-serif')
  })

  it('gives a bundled font its own name and generic fallback', () => {
    const p = integratedProject()
    expect(resolveRole(p, p.typography.roles[2]!).exportStack).toBe('"Manrope", sans-serif')
  })

  it('reports a link to a removed typeface or font as broken, never as another font', () => {
    const p = integratedProject()
    const other = { ...p, customTypeface: createTypeface('face-2') }
    expect(resolveRole(other, p.typography.roles[0]!).origin).toBe('broken')
    expect(resolveFont(p, { kind: 'source', sourceId: 'nope' }).origin).toBe('broken')
  })

  it('lists each font once with the roles that use it', () => {
    const uses = fontsInUse(integratedProject())
    expect(uses.map((u) => [u.font.origin, u.roles.map((r) => r.name)])).toEqual([
      ['custom', ['Display', 'Heading']],
      ['catalog', ['Body', 'Caption']],
      ['system', ['UI']],
    ])
  })

  it('gives roles unique css slugs even when names collide', () => {
    const p = createProject('x', fakeClock())
    const roles = [...p.typography.roles, { ...p.typography.roles[0]!, id: 'a', name: 'Display' }, { ...p.typography.roles[0]!, id: 'b', name: 'Display 2' }, { ...p.typography.roles[0]!, id: 'c', name: '???' }]
    const slugs = [...roleSlugs(roles).values()]
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs).toContain('display-2')
    expect(slugs).toContain('display-2-2')
  })
})

describe('project operations', () => {
  it('assigns the custom typeface only when the project has one', () => {
    const p = createProject('x', fakeClock())
    expect(assignCustomTypeface(p, p.typography.roles[0]!.id)).toBe(p)
  })

  it('returns the same object when nothing changes', () => {
    const p = integratedProject()
    expect(updateRole(p, p.typography.roles[0]!.id, { weight: 400 })).toBe(p)
    expect(assignSource(p, p.typography.roles[0]!.id, 'missing')).toBe(p)
  })

  it('adds a catalog font once and a named font once', () => {
    const clock = fakeClock()
    const p = createProject('x', clock)
    const a = addCatalogFont(p, 'fraunces', clock)!
    const b = addCatalogFont(a.project, 'fraunces', clock)!
    expect(b.sourceId).toBe(a.sourceId)
    expect(b.project.fontSources).toHaveLength(1)
    expect(addCatalogFont(p, 'nope', clock)).toBeNull()
    const c = addNamedFont(b.project, '  Gill   Sans ', 'sans-serif', clock)!
    expect(addNamedFont(c.project, 'gill sans', 'serif', clock)!.sourceId).toBe(c.sourceId)
    expect(c.project.fontSources[1]).toMatchObject({ family: 'Gill Sans', kind: 'system', license: { verified: false } })
    expect(addNamedFont(p, '   ', 'serif', clock)).toBeNull()
  })

  it('removing a font or the typeface unassigns its roles instead of leaving dead links', () => {
    const p = integratedProject()
    const bodyId = p.typography.roles[2]!.id
    const noFont = removeFontSource(p, p.fontSources[0]!.id)
    expect(noFont.typography.roles.find((r) => r.id === bodyId)!.font).toBeNull()
    const noFace = removeCustomTypeface(p)
    expect(noFace.customTypeface).toBeNull()
    expect(rolesUsingCustom(noFace)).toEqual([])
    expect(noFace.typography.roles[0]!.font).toBeNull()
    expect(noFace.typography.roles[2]!.font).not.toBeNull() // other roles untouched
  })
})

describe('does the custom typeface suit a role?', () => {
  const face = () => createTypeface('face-1', 'geometric', 'T')

  it('is suitable for ordinary roles at ordinary sizes with the regular weight', () => {
    const f = face()
    for (const [kind, size] of [['display', 61], ['heading', 31], ['body', 16], ['ui', 12.8]] as const) {
      const fit = assessRoleFit(f, { kind, weight: 400 }, size)
      expect(fit.findings.filter((x) => x.level !== 'notes'), `${kind} at ${size}`).toEqual([])
      expect(fit.verdict).toBe('suitable')
    }
  })

  it('blocks a role when a required character has no usable glyph', () => {
    const f = face()
    // Replace "e" with a frozen, degenerate outline so it fails validation.
    const broken = { ...f, overrides: { e: { contours: [[{ x: 0, y: 0, onCurve: true }, { x: 1, y: 0, onCurve: true }, { x: 2, y: 0, onCurve: true }]] } } }
    const fit = assessRoleFit(broken, { kind: 'body', weight: 400 }, 16)
    expect(fit.verdict).toBe('unsuitable')
    expect(fit.missing).toContain('e')
    expect(fit.findings[0]!.id).toBe('coverage.required')
  })

  it('needs more characters for body text than for a display line', () => {
    expect(REQUIRED_CHARS.body.length).toBeGreaterThan(REQUIRED_CHARS.display.length)
    expect(REQUIRED_CHARS.ui).toContain('%')
    expect(REQUIRED_CHARS.display).not.toContain('0')
  })

  it('blocks tiny sizes and warns near the limit, from measured pixels', () => {
    const f = face()
    expect(assessRoleFit(f, { kind: 'body', weight: 400 }, 7).verdict).toBe('unsuitable') // x-height 3.5px, stroke 0.7px
    const near = assessRoleFit(f, { kind: 'body', weight: 400 }, 11)
    expect(near.findings.map((x) => x.id)).toContain('xheight.small')
    expect(near.verdict).toBe('caution')
  })

  it('blocks a hairline typeface at text size', () => {
    const f = { ...face(), dna: { ...face().dna, strokeThickness: 30, contrast: 0.5 } }
    const fit = assessRoleFit(f, { kind: 'body', weight: 400 }, 16)
    expect(fit.findings.map((x) => x.id)).toContain('stroke.vanishes')
    expect(fit.verdict).toBe('unsuitable')
  })

  it('warns that a display design is used small', () => {
    expect(assessRoleFit(face(), { kind: 'display', weight: 400 }, 16).findings.map((x) => x.id)).toContain('display.small')
  })

  it('warns about synthetic bold, offers weight 400, and only notes lighter weights', () => {
    const f = face()
    const bold = assessRoleFit(f, { kind: 'heading', weight: 700 }, 31)
    expect(bold.verdict).toBe('caution')
    expect(bold.findings.find((x) => x.id === 'weight.synthetic')!.fix).toMatchObject({ kind: 'weight', value: 400 })
    const light = assessRoleFit(f, { kind: 'heading', weight: 300 }, 31)
    expect(light.verdict).toBe('suitable')
    expect(light.findings.map((x) => x.level)).toEqual(['notes'])
  })

  it('finds characters the typeface cannot draw in a given text', () => {
    const f = face()
    expect(missingChars(f, 'Cafe 12')).toEqual([])
    expect(missingChars(f, 'Café\nA&B')).toEqual(['é'])
  })

  it('states its limits from the design, not from a fixed list', () => {
    const f = face()
    const limits = typefaceLimits(f).join('\n')
    expect(limits).toMatch(/One style, Regular/)
    expect(limits).toMatch(/basic Latin only/)
    expect(limits).toMatch(/0 pairs/)
    expect(typefaceLimits({ ...f, kerning: [{ left: 'A', right: 'V', value: -20 }] }).join('\n')).toMatch(/1 pair\)/)
    expect(limits).not.toMatch(/Not designed yet/) // every target character has a design
  })
})

describe('brand previews', () => {
  it('default copy is plain ASCII so only the user\'s own words can trigger a missing-character warning', () => {
    const p = integratedProject()
    const slots = (['website', 'product', 'poster', 'document'] as const).flatMap((a) => applicationSlots(p, defaultCopy(p), a))
    for (const s of slots) expect(s.text, s.id).toMatch(/^[\x20-\x7e]*$/)
    expect(previewMissing(p, slots)).toEqual([])
  })

  it('the printed document uses every role kind a page needs, and a table of figures', () => {
    const p = integratedProject()
    const slots = applicationSlots(p, defaultCopy(p), 'document')
    const styles = new Set(slots.map((s) => s.style))
    for (const style of ['heading', 'caption', 'h1', 'h2', 'body-lg', 'body', 'ui', 'body-sm']) expect(styles, style).toContain(style)
    expect(slots.filter((s) => /^td-\d-amount$/.test(s.id)).map((s) => s.text)).toEqual(['1,200.00', '840.50'])
    expect(slots.find((s) => s.id === 'footer')!.text).toBe('Northwind - page 1 of 1')
    // It reads the saved long-form text, so a person's own paragraphs reach the page.
    const own = applicationSlots(p, { ...defaultCopy(p), longform: 'First of mine.\n\nSecond of mine.' }, 'document')
    expect(own.find((s) => s.id === 'p-0')!.text).toBe('First of mine.')
    expect(own.find((s) => s.id === 'p-1')!.text).toBe('Second of mine.')
  })

  it('warns, per role, about characters the typeface lacks in the text on screen', () => {
    const p = integratedProject('Café Nørd')
    const slots = applicationSlots(p, defaultCopy(p), 'website')
    const missing = previewMissing(p, slots)
    expect(missing.map((m) => m.role.name)).toEqual(['Heading']) // the brand name is set in the heading role; the display line is plain ASCII
    const heading = missing.find((m) => m.role.name === 'Heading')!
    expect(heading.chars).toEqual(expect.arrayContaining(['é', 'ø']))
    expect(heading.samples).toContain('Café Nørd')
  })

  it('does not warn about roles set in existing fonts', () => {
    const p = integratedProject('Café')
    const slots = applicationSlots(p, { ...defaultCopy(p), body: 'ñ' }, 'website')
    expect(previewMissing(p, slots).map((m) => m.role.name)).not.toContain('Body')
  })
})

describe('readiness (validate step)', () => {
  it('has nothing blocking for a sound integrated project, and says external fonts are not included', () => {
    const items = assessProject(integratedProject())
    expect(countLevels(items).blocks).toBe(0)
    expect(items.map((i) => i.id)).toEqual(expect.arrayContaining([expect.stringMatching(/^external\.source:/)]))
    expect(items.find((i) => i.id.startsWith('licence.'))?.message).toMatch(/Helvetica Neue/)
  })

  it('flags roles without a font, with the role id', () => {
    const p = createProject('x', fakeClock())
    const items = assessProject(p)
    expect(items.filter((i) => i.id.startsWith('role.none.'))).toHaveLength(5)
  })

  it('flags broken links, a licence not chosen and a name clash', () => {
    let p = integratedProject()
    const clash = addNamedFont(p, 'northwind sans', 'sans-serif', fakeClock())!
    p = clash.project
    expect(assessProject(p).map((i) => i.id)).toEqual(expect.arrayContaining(['typeface.licence', 'typeface.name-clash']))
    const broken = { ...p, customTypeface: createTypeface('other') }
    expect(assessProject(broken).some((i) => i.id.startsWith('role.broken.'))).toBe(true)
  })

  it('blocks when a used typeface cannot be exported, but only warns when it is unused', () => {
    const p = integratedProject()
    const bad = { ...p.customTypeface!, overrides: { H: { contours: [[{ x: 0, y: 0, onCurve: true }, { x: 1, y: 0, onCurve: true }, { x: 2, y: 0, onCurve: true }]] } } }
    expect(assessProject({ ...p, customTypeface: bad }).find((i) => i.id === 'typeface.not-exportable')!.level).toBe('blocks')
    const unused = removeCustomTypeface(p)
    expect(assessProject({ ...unused, customTypeface: bad }).find((i) => i.id === 'typeface.not-exportable')!.level).toBe('warns')
  })

  it('sorts blocking issues first', () => {
    const p = integratedProject()
    const levels = assessProject(updateRole(p, p.typography.roles[1]!.id, { scaleStep: -6 })).map((i) => i.level)
    expect(levels).toEqual([...levels].sort((a, b) => ['blocks', 'warns', 'info'].indexOf(a) - ['blocks', 'warns', 'info'].indexOf(b)))
    expect(levels[0]).toBe('blocks')
  })

  it('uses the role\'s real size from the scale', () => {
    const p = integratedProject()
    expect(sizeForStep(p.typography.scale, -6)).toBeLessThan(5)
  })
})

describe('content revision', () => {
  it('ignores key order, export history and updatedAt, and notices real edits', async () => {
    const p = integratedProject()
    const same = { ...p, updatedAt: '2030-01-01T00:00:00.000Z', exportHistory: [{ id: 'e', kind: 'spec-md' as const, at: p.createdAt, filename: 'x', bytes: 1 }] }
    expect(await contentRevision(same)).toBe(await contentRevision(p))
    expect(await contentRevision({ ...p, brand: Object.fromEntries(Object.entries(p.brand).reverse()) as typeof p.brand })).toBe(await contentRevision(p))
    expect(await contentRevision(updateRole(p, p.typography.roles[0]!.id, { lineHeight: 1.3 }))).not.toBe(await contentRevision(p))
    expect(await contentRevision({ ...p, name: 'Other' })).not.toBe(await contentRevision(p))
    expect(await contentRevision(p)).toMatch(/^[0-9a-f]{12}$/)
  })
  it('canonical json sorts keys and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: [{ d: undefined, c: 2 }] })).toBe('{"a":[{"c":2}],"b":1}')
  })
})

describe('workflow steps', () => {
  it('reports each stage from the project itself', () => {
    const p = integratedProject()
    const steps = Object.fromEntries(workflowSteps(p, 'aaaaaaaaaaaa').map((s) => [s.id, s.state]))
    expect(steps).toMatchObject({ brand: 'done', fonts: 'done', system: 'done', typeface: 'done', preview: 'done', export: 'todo' })
    const empty = Object.fromEntries(workflowSteps(createProject('x', fakeClock()), null).map((s) => [s.id, s.state]))
    expect(empty).toMatchObject({ brand: 'todo', fonts: 'todo', system: 'todo', typeface: 'optional', preview: 'todo' })
  })
  it('marks the export stale when the project changed since the last export', () => {
    const p = { ...integratedProject(), exportHistory: [{ id: 'e', kind: 'spec-md' as const, at: '2026-01-01T00:00:00.000Z', filename: 'a', bytes: 1, sourceRevision: 'aaaaaaaaaaaa' }] }
    expect(workflowSteps(p, 'aaaaaaaaaaaa').find((s) => s.id === 'export')!.state).toBe('done')
    expect(workflowSteps(p, 'bbbbbbbbbbbb').find((s) => s.id === 'export')!.state).toBe('attention')
  })
})

describe('escaping', () => {
  it('keeps user text from changing the structure of CSS, HTML and Markdown', () => {
    expect(cssString('a"b\\c\nd')).toBe('"a\\"b\\\\c\\a d"')
    expect(escapeHtml('<script>"&\'')).toBe('&lt;script&gt;&quot;&amp;&#39;')
    expect(mdInline('a|b `c` *d* <e>\nf')).toBe('a\\|b \\`c\\` \\*d\\* \\<e\\> f')
  })
})
