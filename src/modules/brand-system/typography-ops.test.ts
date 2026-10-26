import { describe, expect, it } from 'vitest'
import { createProject } from '@/modules/brand-projects/model'
import { parseProject } from '@/modules/brand-projects/migrations'
import { fakeClock, integratedProject } from '@/modules/testing/factories'
import { resolveRole } from './fonts'
import { addCatalogFont, addRole, applyPairing, canRemoveRole, parseFamilies, pairingDeviations, removeCustomTypeface, removeFontSource, removeRole, setCustomFallback, setPairing, setSourceFallback, updateRole, assignSource } from './ops'

describe('roles can be added and removed', () => {
  it('adds a role of any kind with that kind\'s defaults, and refuses empty names', () => {
    const clock = fakeClock()
    const p = createProject('x', clock)
    const q = addRole(p, '  Pull quote ', 'display', clock)!
    const added = q.typography.roles.at(-1)!
    expect(added).toMatchObject({ name: 'Pull quote', kind: 'display', weight: 700, scaleStep: 6, font: null })
    expect(addRole(p, '   ', 'body', clock)).toBeNull()
    expect(parseProject(q).ok).toBe(true)
  })

  it('stops at the most roles a project can hold', () => {
    const clock = fakeClock()
    let p = createProject('x', clock)
    while (p.typography.roles.length < 30) p = addRole(p, `R${p.typography.roles.length}`, 'caption', clock)!
    expect(addRole(p, 'One more', 'caption', clock)).toBeNull()
  })

  it('lets captions go but keeps at least one role for display, heading, body and interface text', () => {
    const p = createProject('x', fakeClock())
    const by = (kind: string) => p.typography.roles.find((r) => r.kind === kind)!
    expect(canRemoveRole(p, by('caption').id)).toBe(true)
    for (const kind of ['display', 'heading', 'body', 'ui']) expect(canRemoveRole(p, by(kind).id), kind).toBe(false)
    expect(removeRole(p, by('body').id)).toBe(p)
    const twoBodies = addRole(p, 'Body 2', 'body', fakeClock())!
    expect(canRemoveRole(twoBodies, by('body').id)).toBe(true)
    expect(removeRole(twoBodies, by('body').id).typography.roles.map((r) => r.name)).toContain('Body 2')
    expect(removeRole(p, by('caption').id).typography.roles.map((r) => r.kind)).not.toContain('caption')
  })
})

describe('font pairing', () => {
  const custom = { kind: 'custom', typefaceId: 'face-1' } as const

  it('applies the primary font to display and headings and the secondary to everything else, and leaves empty slots alone', () => {
    const clock = fakeClock()
    let p = createProject('x', clock)
    const cat = addCatalogFont(p, 'inter', clock)!
    p = setPairing(cat.project, 'secondary', { kind: 'source', sourceId: cat.sourceId })
    const only2nd = applyPairing(p)
    expect(only2nd.typography.roles.map((r) => r.font?.kind ?? null)).toEqual([null, null, 'source', 'source', 'source'])
    const withFace = { ...p, customTypeface: integratedProject().customTypeface }
    const both = applyPairing(setPairing({ ...withFace, customTypeface: { ...withFace.customTypeface!, id: 'face-1' } }, 'primary', custom))
    expect(both.typography.roles.map((r) => r.font?.kind)).toEqual(['custom', 'custom', 'source', 'source', 'source'])
  })

  it('lets roles be changed afterwards, and reports where they differ from the pairing', () => {
    const p = integratedProject()
    const paired = applyPairing(setPairing(setPairing(p, 'primary', custom), 'secondary', p.typography.roles[2]!.font))
    expect(pairingDeviations(paired)).toEqual([])
    const changed = updateRole(paired, paired.typography.roles[2]!.id, { font: null })
    expect(pairingDeviations(changed).map((r) => r.name)).toEqual(['Body'])
    expect(applyPairing(changed)).not.toBe(changed)
    expect(setPairing(paired, 'primary', custom)).toBe(paired)
  })

  it('is cleared, not left dangling, when a font or the typeface is removed', () => {
    const p = integratedProject()
    const sourceId = p.fontSources[0]!.id
    const paired = setPairing(setPairing(p, 'primary', custom), 'secondary', { kind: 'source', sourceId })
    expect(removeFontSource(paired, sourceId).typography.pairing).toEqual({ primary: custom, secondary: null })
    expect(removeCustomTypeface(paired).typography.pairing).toEqual({ primary: null, secondary: { kind: 'source', sourceId } })
  })
})

describe('fallback stacks', () => {
  it('parses a typed list, trimming, de-duplicating and limiting it', () => {
    expect(parseFamilies(' Helvetica Neue, "Arial" ,arial,\n Segoe UI ,, ')).toEqual(['Helvetica Neue', 'Arial', 'Segoe UI'])
    expect(parseFamilies(Array.from({ length: 12 }, (_, i) => `F${i}`).join(','))).toHaveLength(8)
    expect(parseFamilies('')).toEqual([])
  })

  it('puts the families between the font and the generic family, in preview and in export', () => {
    let p = integratedProject()
    const body = p.typography.roles[2]!
    const src = p.fontSources[0]!
    p = setSourceFallback(p, src.id, { fallbackFamilies: ['Helvetica Neue', 'Arial'], fallback: 'sans-serif' })
    expect(resolveRole(p, body).exportStack).toBe('"Manrope", "Helvetica Neue", "Arial", sans-serif')
    expect(resolveRole(p, body).previewStack).toBe('"Manrope", "Helvetica Neue", "Arial", sans-serif')
    p = setCustomFallback(p, { families: ['Georgia'], generic: 'serif' })
    const display = resolveRole(p, p.typography.roles[0]!)
    expect(display.exportStack).toBe('"Northwind Sans", "Georgia", serif')
    expect(display.previewStack).toMatch(/^"BTS Custom \w+", "Georgia", serif$/)
  })

  it('escapes hostile family names in the stack', () => {
    let p = integratedProject()
    p = setSourceFallback(p, p.fontSources[0]!.id, { fallbackFamilies: ['Evil"; } body{x:y} /*'], fallback: 'sans-serif' })
    expect(resolveRole(p, p.typography.roles[2]!).exportStack).toContain('"Evil\\"; } body{x:y} /*"')
  })

  it('a named font keeps its own stack when the catalog font of the same name is added', () => {
    const clock = fakeClock()
    const p = createProject('x', clock)
    const a = addCatalogFont(p, 'inter', clock)!
    expect(assignSource(a.project, a.project.typography.roles[2]!.id, a.sourceId).typography.roles[2]!.font).toEqual({ kind: 'source', sourceId: a.sourceId })
  })
})
