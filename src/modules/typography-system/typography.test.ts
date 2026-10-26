import { describe, expect, it } from 'vitest'
import { createProject } from '@/modules/brand-projects/model'
import { setBodyStep, setHeadingStep, setResponsive } from '@/modules/brand-system/ops'
import { applicationSlots, effectiveCopy, previewMissing, styleForSlot, styleProps } from '@/modules/brand-system/preview'
import { fakeClock, integratedProject } from '@/modules/testing/factories'
import { cssSize, sizeAt, sizeSpec } from './scale'
import { findStyle, typeStyles } from './tokens'
import { typographyIssues } from './validate'

const fluid = (p = createProject('x', fakeClock())) => setResponsive(p, { enabled: true })

/** Evaluate a clamp(min, a rem + b vw, max) string the way a browser does at a viewport width. */
function evalClamp(css: string, vw: number): number {
  const m = /^clamp\(([\d.]+)rem, (-?[\d.]+)rem \+ (-?[\d.]+)vw, ([\d.]+)rem\)$/.exec(css)
  if (!m) throw new Error(`not a clamp(): ${css}`)
  const [lo, a, b, hi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  return Math.min(hi, Math.max(lo, a + (b / 100) * vw / 16)) * 16
}

describe('responsive sizes', () => {
  it('are fixed while responsive sizing is off', () => {
    const p = createProject('x', fakeClock())
    expect(sizeSpec(p.typography, 3)).toEqual({ step: 3, minPx: 31.25, maxPx: 31.25, fluid: false })
    expect(sizeAt(p.typography, 3, 320)).toBe(31.25)
    expect(cssSize(p.typography, 3)).toBe('1.9531rem')
  })

  it('interpolate between the small and the main scale, and hold at both ends', () => {
    const p = fluid()
    const t = p.typography // 14px/1.125 at 320, 16px/1.25 at 1280
    expect(sizeAt(t, 0, 320)).toBe(14)
    expect(sizeAt(t, 0, 100)).toBe(14)
    expect(sizeAt(t, 0, 1280)).toBe(16)
    expect(sizeAt(t, 0, 4000)).toBe(16)
    expect(sizeAt(t, 0, 800)).toBe(15)
    expect(sizeAt(t, 6, 320)).toBeLessThan(sizeAt(t, 6, 1280))
  })

  it('the exported CSS clamp() gives the same size the preview computes, at every viewport', () => {
    const t = fluid().typography
    for (const step of [-2, 0, 3, 6]) {
      const css = cssSize(t, step)
      for (const vw of [200, 320, 500, 768, 1024, 1280, 1800]) expect(evalClamp(css, vw), `step ${step} @${vw}`).toBeCloseTo(sizeAt(t, step, vw), 1)
    }
  })

  it('stay valid when the small scale is larger than the main one', () => {
    const t = setResponsive(fluid(), { minBaseSizePx: 20, minRatio: 1.3 }).typography
    const css = cssSize(t, 2)
    for (const vw of [320, 800, 1280]) expect(evalClamp(css, vw)).toBeCloseTo(sizeAt(t, 2, vw), 1)
  })
})

describe('type styles are one description for previews and exports', () => {
  it('lists the roles, six heading levels and two extra body sizes', () => {
    const p = integratedProject()
    const styles = typeStyles(p)
    expect(styles.filter((s) => s.kind === 'role')).toHaveLength(5)
    expect(styles.filter((s) => s.kind === 'level').map((s) => [s.id, s.step])).toEqual([['h1', 5], ['h2', 4], ['h3', 3], ['h4', 2], ['h5', 1], ['h6', 0]])
    expect(styles.filter((s) => s.kind === 'body-size').map((s) => [s.id, s.step])).toEqual([['body-lg', 1], ['body-sm', -1]])
    expect(findStyle(p, 'h1')!.role!.kind).toBe('heading')
    expect(findStyle(p, 'body-sm')!.role!.kind).toBe('body')
  })

  it('edits to heading and body sizes change the style and nothing else', () => {
    const p = integratedProject()
    const q = setBodyStep(setHeadingStep(p, 0, 7), 'bodySmall', -2)
    expect(findStyle(q, 'h1')!.step).toBe(7)
    expect(findStyle(q, 'h2')!.step).toBe(4)
    expect(findStyle(q, 'body-sm')!.step).toBe(-2)
    expect(setHeadingStep(p, 0, 5)).toBe(p)
    expect(setHeadingStep(p, 9, 1)).toBe(p)
  })

  it('give a preview slot the style the exported class would have, size included', () => {
    const p = fluid(integratedProject())
    const style = styleForSlot(p, 'h2')!
    const props = styleProps(p, style, 500)
    expect(props.fontSize).toBe(sizeAt(p.typography, 4, 500))
    expect(props.fontFamily).toContain('BTS Custom') // the heading role is set in the custom typeface
    expect(props.fontWeight).toBe(style.role!.weight)
    expect(styleForSlot(p, 'display')!.role!.kind).toBe('display')
  })

  it('warn about missing characters for heading levels, not only for roles', () => {
    const p = integratedProject('Café')
    const slots = applicationSlots(p, effectiveCopy(p), 'editorial')
    expect(slots.some((s) => s.style === 'h1')).toBe(true)
    const p2 = { ...p, brand: { ...p.brand, sampleCopy: { headline: 'Smörgåsbord' } } }
    const missing = previewMissing(p2, applicationSlots(p2, effectiveCopy(p2), 'editorial'))
    expect(missing.map((m) => m.role.name)).toContain('Heading') // h1 uses the heading role's font
    expect(missing.find((m) => m.role.name === 'Heading')!.chars).toEqual(expect.arrayContaining(['ö', 'å']))
  })

  it('saved sample copy overrides the defaults and nothing else', () => {
    const p = createProject('Acme', fakeClock())
    const q = { ...p, brand: { ...p.brand, name: 'Acme Labs', sampleCopy: { headline: 'Hello' } } }
    const c = effectiveCopy(q)
    expect(c.headline).toBe('Hello')
    expect(c.subhead).toContain('Acme Labs')
    expect(c.body).toBe(effectiveCopy(p).body)
  })
})

describe('impractical values are explained', () => {
  const ids = (p: Parameters<typeof typographyIssues>[0]) => typographyIssues(p).map((i) => i.id)

  it('finds nothing wrong with the defaults', () => {
    expect(typographyIssues(createProject('x', fakeClock()))).toEqual([])
  })

  it('flags scale values that are allowed but unlikely to be meant', () => {
    const p = createProject('x', fakeClock())
    const set = (s: Partial<typeof p.typography.scale>) => ({ ...p, typography: { ...p.typography, scale: { ...p.typography.scale, ...s } } })
    expect(ids(set({ baseSizePx: 10 }))).toContain('scale.base-small')
    expect(ids(set({ baseSizePx: 30 }))).toContain('scale.base-large')
    expect(ids(set({ ratio: 1.8 }))).toContain('scale.ratio-large')
    expect(ids(set({ ratio: 1.02 }))).toContain('scale.ratio-small')
    expect(ids(set({ ratio: 1 }))).toContain('scale.flat')
  })

  it('flags role values for the kind of text the role sets, in plain words', () => {
    const p = createProject('x', fakeClock())
    const roles = p.typography.roles.map((r) => (r.kind === 'body' ? { ...r, lineHeight: 1.1, letterSpacingEm: 0.12, scaleStep: -2 } : r.kind === 'heading' ? { ...r, lineHeight: 1.8 } : r))
    const issues = typographyIssues({ ...p, typography: { ...p.typography, roles } })
    const text = issues.map((i) => i.message).join('\n')
    expect(text).toMatch(/Body is 10.2px at its smallest; body text under 14px/)
    expect(text).toMatch(/Body has a line height of 1.1; running text usually needs 1.4 or more/)
    expect(text).toMatch(/Body has 0.12em of letter spacing/)
    expect(text).toMatch(/Heading has a line height of 1.8/)
    for (const i of issues.filter((x) => x.field === 'role')) expect(i.roleId).toBeTruthy()
  })

  it('flags sizes out of order and a small-screen base that is larger than the main one', () => {
    let p = setHeadingStep(createProject('x', fakeClock()), 1, 6)
    expect(ids(p)).toContain('sizes.h2-above-h1')
    p = setResponsive(setResponsive(createProject('x', fakeClock()), { enabled: true }), { minBaseSizePx: 20 })
    expect(ids(p)).toContain('responsive.inverted')
    const small = typographyIssues(setResponsive(fluid(), { minBaseSizePx: 10 })).map((i) => i.id)
    expect(small).toContain('responsive.small')
  })

  it('uses the smallest fluid size for the body-size warning', () => {
    const p = setResponsive(fluid(), { minBaseSizePx: 12, minRatio: 1 })
    expect(typographyIssues(p).some((i) => /Body is 12px at its smallest/.test(i.message))).toBe(true)
  })
})
