import { expect, test, type Page } from '@playwright/test'
import { createProject, readProjects, writeProjects } from './helpers'

/**
 * Runtime performance. Ceilings are generous on purpose (a shared CI machine is slower than a laptop): they catch work that
 * became unbounded, not small drifts. Size budgets are in scripts/check-budgets.mjs.
 */

function transfers(page: Page) {
  const got: { path: string; type: string }[] = []
  page.on('response', (r) => got.push({ path: new URL(r.url()).pathname, type: r.request().resourceType() }))
  return {
    any: (re: RegExp) => got.some((g) => re.test(g.path)),
    /** Distinct files: `vite preview` sends no cache headers, so a second page load would fetch the same file again. */
    count: (re: RegExp) => new Set(got.filter((g) => re.test(g.path)).map((g) => g.path)).size,
  }
}

test.describe('what is downloaded, and when', () => {
  test('the website and the dashboard never fetch the font writer, its wasm, or a catalog font', async ({ page }) => {
    const net = transfers(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.goto('/app/projects')
    await page.waitForLoadState('networkidle')
    expect(net.any(/font-flux/)).toBe(false)
    expect(net.any(/\.wasm$/)).toBe(false)
    expect(net.count(/\.woff2$/)).toBe(1) // Manrope Latin, the interface font
  })

  test('the font writer stays out of every page that has no typeface, loads once where a real font is needed, and its wasm never loads', async ({ page }) => {
    const net = transfers(page)
    await createProject(page, 'Lazy', 'Overview')
    const sections = page.getByRole('navigation', { name: 'Project sections' })
    for (const section of ['Font catalog', 'Brand Typography System']) {
      await sections.getByRole('link', { name: section }).click()
      await expect(page.getByRole('main')).toBeVisible()
    }
    await page.waitForTimeout(1500) // a lazy load would have started by now
    expect(net.any(/font-flux/)).toBe(false)

    // The typeface editor draws the real exported font next to its own drawing, so it needs the writer.
    await sections.getByRole('link', { name: 'Custom Typeface Creator' }).click()
    await page.getByRole('button', { name: /Start with Rounded/ }).click()
    await expect(page.getByLabel('Typeface name')).toBeVisible()
    await expect.poll(() => net.count(/font-flux/)).toBe(1)

    await page.getByRole('link', { name: 'Export', exact: true }).first().click()
    await page.getByRole('button', { name: /Check and build/ }).click()
    await expect(page.getByRole('complementary', { name: 'Font export' })).toContainText('Built a TrueType (.ttf) file')
    expect(net.count(/font-flux/)).toBe(1) // fetched once, then reused
    expect(net.any(/\.wasm$/)).toBe(false)
  })

  test('scrolling the whole font catalog downloads a bounded number of font files, not all of them', async ({ page }) => {
    const net = transfers(page)
    await createProject(page, 'Catalog', 'Overview')
    await page.getByRole('navigation', { name: 'Project sections' }).getByRole('link', { name: 'Font catalog' }).click()
    await expect(page.getByRole('main')).toBeVisible()
    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel(0, 1200)
      await page.waitForTimeout(60)
    }
    await page.waitForLoadState('networkidle')
    // The catalog has 24 families with several weights and styles each (150+ files). A visit may not fetch them all.
    expect(net.count(/\.woff2$/)).toBeLessThanOrEqual(40)
  })
})

test.describe('a large project stays responsive', () => {
  const GLYPHS = [...Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i))].filter((c) => !'&@{}~'.includes(c))
  const ring = (r: number, n: number, clockwise: boolean) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((clockwise ? -1 : 1) * 2 * Math.PI * i) / n
      return { x: Math.round(320 + r * Math.cos(a)), y: Math.round(350 + r * Math.sin(a)), onCurve: true }
    })

  test('90 hand-edited glyphs of 900 points each and 5,000 kerning pairs open, scroll and take typing without freezing', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __long: number[] }
      w.__long = []
      new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__long.push(e.duration))).observe({ type: 'longtask', buffered: true })
    })
    await createProject(page, 'Heavy', 'Custom Typeface Creator')
    await page.getByRole('button', { name: /Start with Rounded/ }).click()
    await expect(page.getByLabel('Typeface name')).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible()

    const [row] = await readProjects(page)
    const overrides = Object.fromEntries(GLYPHS.map((c) => [c, { advanceWidth: 640, contours: [ring(300, 300, true), ring(200, 300, false), ring(80, 300, true)] }]))
    const kerning: { left: string; right: string; value: number }[] = []
    for (const l of GLYPHS) for (const r of GLYPHS) if (kerning.length < 5000 && l !== r) kerning.push({ left: l, right: r, value: ((l.charCodeAt(0) + r.charCodeAt(0)) % 41) - 20 })
    row!['customTypeface'] = { ...row!['customTypeface'], overrides, kerning }
    row!['updatedAt'] = new Date(Date.now() + 5000).toISOString()
    await writeProjects(page, [row!])

    const t0 = Date.now()
    await page.reload()
    await expect(page.getByLabel('Typeface name')).toBeVisible({ timeout: 15_000 })
    const opened = Date.now() - t0
    test.info().annotations.push({ type: 'open ms', description: String(opened) })
    expect(opened).toBeLessThan(8000)

    const t1 = Date.now()
    await page.getByRole('button', { name: 'Glyphs', exact: true }).click()
    await expect(page.getByRole('button', { name: /^H, supported/ })).toBeVisible({ timeout: 15_000 })
    const grid = Date.now() - t1
    test.info().annotations.push({ type: 'glyph grid ms', description: String(grid) })
    expect(grid).toBeLessThan(5000)

    await page.getByRole('button', { name: 'Preview', exact: true }).click()
    const text = page.getByLabel('Preview text')
    await text.fill('')
    const t2 = Date.now()
    await text.pressSequentially('Hamburgefonstiv 0123456789', { delay: 0 })
    const typing = Date.now() - t2
    test.info().annotations.push({ type: 'typing 26 keys ms', description: String(typing) })
    expect(typing).toBeLessThan(8000)

    const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long)
    const worst = Math.max(0, ...long)
    test.info().annotations.push({ type: 'longest main-thread task ms', description: String(Math.round(worst)) })
    expect(worst).toBeLessThan(2000)
  })
})
