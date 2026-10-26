import { describe, expect, it } from 'vitest'
import { parseProject } from '@/modules/brand-projects/migrations'
import { summarize } from '@/modules/brand-projects/schema'
import { analyzeTypeface } from '@/modules/font-validation/coverage'
import { assessRoleFit } from './fit'
import { resolveRole, rolesUsingCustom } from './fonts'
import { pairingDeviations } from './ops'
import { assessProject, countLevels } from './readiness'
import { createSampleProject, SAMPLE_PROJECT_ID } from './sample'
import { workflowSteps } from './workflow'
import { sizeSpec } from '@/modules/typography-system/scale'
import { typographyIssues } from '@/modules/typography-system/validate'

describe('the sample project', () => {
  const p = createSampleProject()

  it('is a valid, current project and is identical every time', () => {
    const r = parseProject(p)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.migratedFrom).toBeNull()
    expect(p.id).toBe(SAMPLE_PROJECT_ID)
    expect(JSON.stringify(createSampleProject())).toBe(JSON.stringify(p))
  })

  it('shows every part of the product: brand direction, two catalog fonts, a custom typeface, a pairing, fluid sizes', () => {
    expect(p.brand).toMatchObject({ name: 'Fieldnote', tones: ['friendly', 'elegant'], useCases: ['consumer', 'editorial', 'campaign'] })
    expect(p.fontSources.map((s) => [s.family, s.kind])).toEqual([['Fraunces', 'catalog'], ['Source Sans 3', 'catalog']])
    expect(p.customTypeface!.familyName).toBe('Fieldnote Rounded')
    expect(p.customTypeface!.variants).toHaveLength(2)
    expect(p.typography.pairing.primary).not.toBeNull()
    expect(p.typography.responsive.enabled).toBe(true)
    expect(p.exportHistory).toEqual([])
  })

  it('has a font on every role, the custom typeface on display, and the pairing differing only there', () => {
    expect(p.typography.roles.map((r) => [r.name, resolveRole(p, r).origin, resolveRole(p, r).family])).toEqual([
      ['Display', 'custom', 'Fieldnote Rounded'], ['Heading', 'catalog', 'Fraunces'], ['Body', 'catalog', 'Source Sans 3'], ['UI', 'catalog', 'Source Sans 3'], ['Caption', 'catalog', 'Source Sans 3'],
    ])
    expect(rolesUsingCustom(p).map((r) => r.name)).toEqual(['Display'])
    expect(pairingDeviations(p).map((r) => r.name)).toEqual(['Display'])
  })

  it('the typeface suits the role it is used for, and has working glyphs', () => {
    const display = p.typography.roles[0]!
    const fit = assessRoleFit(p.customTypeface!, display, sizeSpec(p.typography, display.scaleStep).minPx)
    expect(fit.verdict).toBe('suitable')
    expect(analyzeTypeface(p.customTypeface!).supportedCount).toBeGreaterThan(85)
  })

  it('its numbers are sound, and its preview text has no characters the typeface lacks', () => {
    expect(typographyIssues(p)).toEqual([])
    const items = assessProject(p)
    expect(items.filter((i) => i.id.startsWith('preview.missing') || i.id.startsWith('fit.') || i.id.startsWith('typography.'))).toEqual([])
    expect(countLevels(items).blocks).toBe(0)
  })

  it('reads as a finished project on the overview, with the one thing left to do: export', () => {
    const states = Object.fromEntries(workflowSteps(p, null).map((s) => [s.id, s.state]))
    expect(states).toMatchObject({ brand: 'done', fonts: 'done', system: 'done', scale: 'done', typeface: 'done', preview: 'done', export: 'todo' })
  })

  it('summarises for a card with everything a person wants to know', () => {
    expect(summarize(p)).toMatchObject({ name: 'Fieldnote sample', brandName: 'Fieldnote', fontCount: 3, rolesTotal: 5, rolesWithFont: 5, typefaceName: 'Fieldnote Rounded', exportCount: 0, lastExportAt: null, tones: ['friendly', 'elegant'] })
  })
})
