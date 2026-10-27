// @vitest-environment node
import { parseProject } from '@/modules/brand-projects/migrations'
import type { Contour, KerningPair, Project } from '@/modules/brand-projects/schema'
import { contentRevision } from '@/modules/brand-system/revision'
import { runQualityChecks } from '@/modules/font-validation/quality'
import { fakeClock, integratedProject } from '@/modules/testing/factories'
import { TARGET_CHARS } from '@/modules/typeface-engine/charset'
import { generateTypeface } from '@/modules/typeface-engine/generate'
import { exportTypeface } from './typefaceExport'

/**
 * Large projects must not freeze the interface. These are not benchmarks: each ceiling is several times what a laptop
 * needs, so a failure means something became quadratic or unbounded, not that the machine was slow.
 * What counts as "large" is the most the file format accepts for kerning (5,000 pairs) and a hand-edited outline for
 * every character, each made of 3 contours of 300 points (so 85,500 points).
 */
const PER_GLYPH_CONTOURS = 3
const POINTS_PER_CONTOUR = 300

const ring = (cx: number, cy: number, r: number, n: number, clockwise: boolean): Contour =>
  Array.from({ length: n }, (_, i) => {
    const a = ((clockwise ? -1 : 1) * 2 * Math.PI * i) / n
    return { x: Math.round(cx + r * Math.cos(a)), y: Math.round(cy + r * Math.sin(a)), onCurve: true }
  })

function largeProject(): Project {
  const base = integratedProject('Large')
  const overrides: Record<string, { advanceWidth: number; contours: Contour[] }> = {}
  for (const c of TARGET_CHARS) {
    overrides[c] = {
      advanceWidth: 640,
      contours: [ring(320, 350, 300, POINTS_PER_CONTOUR, true), ring(320, 350, 200, POINTS_PER_CONTOUR, false), ring(320, 350, 80, POINTS_PER_CONTOUR, true)].slice(0, PER_GLYPH_CONTOURS),
    }
  }
  const kerning: KerningPair[] = []
  for (const l of TARGET_CHARS) for (const r of TARGET_CHARS) if (kerning.length < 5000 && l !== r) kerning.push({ left: l, right: r, value: ((l.charCodeAt(0) + r.charCodeAt(0)) % 41) - 20 })
  return { ...base, customTypeface: { ...base.customTypeface!, overrides, kerning } }
}

async function timed<T>(fn: () => T | Promise<T>): Promise<{ value: T; ms: number }> {
  const t = performance.now()
  const value = await fn()
  return { value, ms: performance.now() - t }
}

describe('a large project', () => {
  const project = largeProject()

  it('really is large', () => {
    expect(project.customTypeface!.kerning).toHaveLength(5000)
    expect(Object.keys(project.customTypeface!.overrides)).toHaveLength(TARGET_CHARS.length)
    expect(JSON.stringify(project).length).toBeGreaterThan(2_000_000)
  })

  it('is read, validated and given a revision quickly', async () => {
    const text = JSON.stringify(project)
    const parsed = await timed(() => parseProject(JSON.parse(text)))
    expect(parsed.value.ok).toBe(true)
    expect(parsed.ms).toBeLessThan(3000)
    const rev = await timed(() => contentRevision(project))
    expect(rev.value).toMatch(/^[0-9a-f]{8,}/)
    expect(rev.ms).toBeLessThan(3000)
  })

  it('draws every glyph quickly', async () => {
    const drawn = await timed(() => generateTypeface(project.customTypeface!))
    expect(drawn.ms).toBeLessThan(3000)
  })

  it('is checked for quality within a few seconds and reports instead of throwing', async () => {
    const checked = await timed(() => runQualityChecks(project.customTypeface!))
    expect(Array.isArray(checked.value.findings)).toBe(true)
    expect(checked.ms).toBeLessThan(8000)
  })

  it('is exported, or refused with reasons, within a few seconds', async () => {
    let n = 0
    const out = await timed(() => exportTypeface(project, () => `id-${n++}`, () => fakeClock().now(), 'ttf'))
    // Outlines this crude may well be refused (that is the validator doing its job); freezing is the failure.
    expect(typeof out.value.ok).toBe('boolean')
    expect(out.ms).toBeLessThan(15000)
  })
})
