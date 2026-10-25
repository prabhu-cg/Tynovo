import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import * as fontkit from 'fontkit'
import { createProject, readProjects, saved, writeProjects } from './helpers'

const params = (page: Page) => page.getByLabel('Design parameters')
const specimenPath = (page: Page) => page.getByRole('img', { name: /^Specimen:/ }).locator('path').first().getAttribute('d')

async function startTypeface(page: Page, name = 'Face', family: 'Geometric' | 'Rounded' | 'Modular' = 'Geometric') {
  await createProject(page, name, 'Custom Typeface Creator')
  await page.getByRole('button', { name: new RegExp(`Start with ${family}`) }).click()
  await expect(page.getByLabel('Typeface name')).toBeVisible()
}

test('font lab builds a genuine TrueType file the browser accepts and renders', async ({ page }) => {
  await page.goto('/app/lab')
  await expect(page.getByTestId('font-sample')).toHaveAttribute('data-font-state', 'ready')
  expect(await page.evaluate(() => document.fonts.check("32px 'Lab Typeface'", 'HOTEL'))).toBe(true)
  const widths = await page.evaluate(() => {
    const measure = (text: string, font: string) => {
      const c = document.createElement('canvas').getContext('2d')!
      c.font = font
      return c.measureText(text).width
    }
    return { gen: measure('HOTEL', "100px 'Lab Typeface', monospace"), mono: measure('HOTEL', '100px monospace') }
  })
  expect(widths.gen).not.toBeCloseTo(widths.mono, 0)
  await expect(page.getByLabel('Exported file facts')).toContainText('Lab Typeface')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download LabTypeface-Regular\.ttf/ }).click()])
  const bytes = readFileSync(await download.path())
  expect(bytes.readUInt32BE(0)).toBe(0x00010000)
  expect(bytes.includes(Buffer.from('glyf'))).toBe(true)
})

test.describe('custom typeface creator', () => {
  test('starts from a family and reports honest coverage', async ({ page }) => {
    await startTypeface(page)
    await expect(page.getByText('90 of 95 characters supported')).toBeVisible()
    await page.getByRole('button', { name: 'Coverage', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: '90 of 95 target characters supported' })).toBeVisible()
    await expect(page.getByRole('row', { name: /Uppercase A–Z 26 \/ 26/ })).toBeVisible()
    await expect(page.getByRole('row', { name: /Punctuation and symbols 27 \/ 32/ })).toBeVisible()
    const missing = page.getByRole('region', { name: 'Not in the font' }).or(page.locator('section[aria-labelledby="miss-h"]'))
    for (const c of ['&', '@', '{', '}', '~']) await expect(missing.getByText(c, { exact: true })).toBeVisible()
    await expect(missing.getByText('Not designed yet').first()).toBeVisible()
    await expect(page.getByText('Every generated glyph passes validation.')).toBeVisible()
  })

  test('changing a parameter redraws the glyphs and survives a reload; keyboard operable', async ({ page }) => {
    await startTypeface(page)
    const before = await specimenPath(page)
    const stroke = params(page).getByLabel('Stroke thickness')
    await stroke.focus()
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
    await expect(stroke).toHaveAttribute('aria-valuetext', '100') // 90 + 5 steps of 2
    expect(await specimenPath(page)).not.toBe(before)
    await saved(page)
    await page.reload()
    await expect(params(page).getByLabel('Stroke thickness')).toHaveAttribute('aria-valuetext', '100')
  })

  test('switching family loads its defaults, saves a restore point and restores', async ({ page }) => {
    await startTypeface(page)
    await params(page).getByText('Rounded', { exact: true }).click()
    await expect(params(page).getByLabel('Stroke thickness')).toHaveAttribute('aria-valuetext', '100')
    await page.getByRole('button', { name: 'Variants', exact: true }).click()
    const points = page.getByRole('list', { name: 'Restore points' })
    // The first change of a visit saves the design as it was when opened (identical points are never duplicated).
    await expect(points).toContainText('When you opened it')
    await points.getByRole('button', { name: 'Restore' }).first().click()
    await expect(params(page).getByLabel('Geometric', { exact: true })).toBeChecked() // restored
  })

  test('glyph overrides persist across global edits and reloads, and only an explicit reset removes them', async ({ page }) => {
    await startTypeface(page)
    await page.getByRole('button', { name: 'Glyphs', exact: true }).click()
    await page.getByRole('button', { name: /^H, supported/ }).click()
    const panel = page.getByRole('complementary', { name: 'Glyph H' })
    const width = panel.getByRole('slider', { name: 'Width' })
    await width.focus()
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight')
    await expect(panel.getByRole('button', { name: /Follow the global value \(1\)/ }).first()).toBeVisible()
    await panel.getByRole('button', { name: 'Close Glyph H' }).click()
    await expect(page.getByRole('button', { name: 'H, supported, has overrides' })).toBeVisible()

    // A global edit does not touch the override.
    const stroke = params(page).getByLabel('Stroke thickness')
    await stroke.focus()
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('button', { name: 'H, supported, has overrides' })).toBeVisible()
    await saved(page)

    await page.reload()
    await page.getByRole('button', { name: 'Glyphs', exact: true }).click()
    await expect(page.getByRole('button', { name: 'H, supported, has overrides' })).toBeVisible()
    const stored = (await readProjects(page))[0]!
    expect(stored['customTypeface'].overrides.H.params.widthScale).toBeCloseTo(1.12)
    expect(stored['customTypeface'].dna.strokeThickness).toBe(98)

    await page.getByRole('button', { name: 'H, supported, has overrides' }).click()
    await page.getByRole('complementary', { name: 'Glyph H' }).getByRole('button', { name: 'Reset all overrides on this glyph' }).click()
    await expect(page.getByRole('button', { name: 'H, supported', exact: true })).toBeVisible()
  })

  test('a character without a design shows a clear missing state', async ({ page }) => {
    await startTypeface(page)
    await page.getByRole('button', { name: 'Glyphs', exact: true }).click()
    await page.getByRole('button', { name: '~, missing' }).click()
    const panel = page.getByRole('complementary', { name: 'Glyph ~' })
    await expect(panel).toContainText('no design yet')
    await expect(panel.getByRole('slider')).toHaveCount(0) // nothing to override on a glyph that does not exist
  })

  test('variants are deterministic, can be saved as favourites, applied and undone', async ({ page }) => {
    await startTypeface(page)
    await page.getByRole('button', { name: 'Variants', exact: true }).click()
    const candidates = page.getByRole('list', { name: 'Candidates' })
    const first = await candidates.getByRole('listitem').nth(1).innerText()
    await page.getByRole('button', { name: 'Next seed' }).click()
    expect(await candidates.getByRole('listitem').nth(1).innerText()).not.toBe(first)
    await page.getByLabel('Seed', { exact: true }).fill('1')
    expect(await candidates.getByRole('listitem').nth(1).innerText()).toBe(first) // same design + seed + spread: same variant

    await page.getByRole('button', { name: 'Save candidate 1 as favourite' }).click()
    const savedList = page.getByRole('list', { name: 'Saved variants' })
    await expect(savedList).toContainText('Seed 1 · 1')
    await expect(savedList).toContainText('Seed 1, spread 0.3, #1')
    await expect(savedList.getByRole('button', { name: /Remove .* as favourite/ })).toBeVisible()

    // Change something first, so applying the variant has a different design to remember.
    const stroke = params(page).getByLabel('Stroke thickness')
    await stroke.focus()
    await page.keyboard.press('ArrowRight')
    await expect(stroke).toHaveAttribute('aria-valuetext', '92')
    await savedList.getByRole('button', { name: 'Apply' }).click()
    const points = page.getByRole('list', { name: 'Restore points' })
    await expect(points).toContainText('When you opened it')
    await expect(points).toContainText('Before applying')
    await points.getByRole('button', { name: 'Restore' }).first().click() // newest first: the state just before applying
    await expect(stroke).toHaveAttribute('aria-valuetext', '92')
    // The variant is still saved.
    await expect(savedList).toContainText('Seed 1 · 1')
    await saved(page)
    await page.reload()
    await page.getByRole('button', { name: 'Variants', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Saved variants' })).toContainText('Seed 1, spread 0.3, #1')
  })

  test('comparing variants shows them side by side', async ({ page }) => {
    await startTypeface(page)
    await page.getByRole('button', { name: 'Variants', exact: true }).click()
    const boxes = page.getByRole('checkbox', { name: 'Compare' })
    await boxes.nth(0).check()
    await boxes.nth(1).check()
    const side = page.getByRole('region', { name: 'Side by side' }).or(page.locator('section[aria-labelledby="cmp-h"]'))
    await expect(side).toContainText('Current design')
    await expect(side).toContainText('Candidate 1')
    await expect(side).toContainText('Candidate 2')
  })

  test('parameters can be edited on a phone-sized screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await startTypeface(page)
    await expect(params(page)).toBeHidden()
    await page.getByRole('button', { name: 'Design parameters' }).click()
    await expect(params(page).getByLabel('Stroke thickness')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test.describe('export', () => {
  test('exports a real, valid TrueType file with exactly the supported glyphs, and records it', async ({ page }) => {
    await startTypeface(page, 'Exporter', 'Rounded')
    await page.getByLabel('Typeface name').fill('Test Display')
    await page.getByRole('link', { name: 'Export…' }).click()
    await expect(page).toHaveURL(/\/export$/)
    await expect(page.getByText('Export history')).toBeVisible()
    await expect(page.getByText('Nothing exported yet')).toBeVisible() // nothing is reported before a file exists
    await page.getByRole('button', { name: /Validate and export TrueType/ }).click()
    const drawer = page.getByRole('complementary', { name: 'Font export' })
    await expect(drawer).toContainText('Built a TrueType file')
    await expect(drawer).toContainText('90 of 95')
    await expect(drawer).toContainText('has not been confirmed')
    const [download] = await Promise.all([page.waitForEvent('download'), drawer.getByRole('button', { name: /Download TestDisplay-Regular\.ttf/ }).click()])
    const bytes = readFileSync(await download.path())
    expect(bytes.readUInt32BE(0)).toBe(0x00010000)
    const font = fontkit.create(bytes) as fontkit.Font
    expect(font.familyName).toBe('Test Display')
    expect(font.numGlyphs).toBe(91) // 90 supported + .notdef
    for (const c of 'AHZaxz09.?!') expect(font.hasGlyphForCodePoint(c.codePointAt(0)!), c).toBe(true)
    for (const c of '&@{}~') expect(font.hasGlyphForCodePoint(c.codePointAt(0)!), c).toBe(false)
    expect(font.glyphForCodePoint('I'.codePointAt(0)!).bbox.minY).toBe(0)
    await expect(page.getByText(/SHA-256 [0-9a-f]{64}/)).toBeVisible()
    await saved(page)
    await page.reload()
    await expect(page.getByText('TestDisplay-Regular.ttf').first()).toBeVisible()
  })

  test('is blocked, with no file offered, when a glyph fails validation', async ({ page }) => {
    await startTypeface(page, 'Broken')
    await saved(page)
    // Plant an outer contour wound the wrong way as a frozen outline of H.
    const [row] = await readProjects(page)
    row!['customTypeface'].overrides = { H: { contours: [[{ x: 0, y: 0, onCurve: true }, { x: 100, y: 0, onCurve: true }, { x: 100, y: 700, onCurve: true }, { x: 0, y: 700, onCurve: true }]] } }
    await writeProjects(page, [row!])
    await page.reload()
    await page.getByRole('link', { name: 'Export', exact: true }).first().click()
    await page.getByRole('button', { name: /Validate and export TrueType/ }).click()
    const drawer = page.getByRole('complementary', { name: 'Font export' })
    await expect(drawer).toContainText('Export blocked')
    await expect(drawer).toContainText('glyph H')
    await expect(drawer.getByRole('button', { name: /Download/ })).toHaveCount(0)
    await expect(drawer).not.toContainText('Built a TrueType file')
  })

  test('without a typeface the export page offers nothing to download', async ({ page }) => {
    await createProject(page, 'No face')
    await page.getByRole('link', { name: 'Export', exact: true }).click()
    await expect(page.getByText('This project has no custom typeface yet.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Validate and export/ })).toHaveCount(0)
  })
})

test('a Phase-0/1 project (schema v1) opens, is migrated and generates a full typeface', async ({ page }) => {
  await page.goto('/app/projects')
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible()
  const at = '2026-01-01T00:00:00.000Z'
  await writeProjects(page, [
    {
      schemaVersion: 1,
      id: 'legacy-1',
      name: 'Legacy project',
      createdAt: at,
      updatedAt: at,
      brand: { personality: ['precise'], notes: '' },
      typography: { scale: { baseSizePx: 16, ratio: 1.25, stepsDown: 2, stepsUp: 6 }, roles: [] },
      fontSources: [],
      exportHistory: [],
      customTypeface: {
        id: 'old-face',
        familyName: 'Proof Sans',
        styleName: 'Regular',
        params: { stem: 130, width: 620, radius: 220 },
        metrics: { unitsPerEm: 1000, ascender: 800, descender: -200, lineGap: 0, capHeight: 700, xHeight: 500 },
        spacing: { defaultSidebearing: 70, trackingUnits: 0 },
        glyphs: {},
        overrides: { H: { advanceWidth: 640 } },
        kerning: [],
        license: { name: 'OFL-1.1', verified: true },
        copyright: 'Copyright 2026 Legacy',
      },
    },
  ])
  await page.reload()
  await page.getByRole('link', { name: 'Legacy project' }).click()
  await page.getByRole('link', { name: 'Custom Typeface Creator' }).click()
  await expect(page.getByLabel('Typeface name')).toHaveValue('Proof Sans')
  await expect(page.getByText('90 of 95 characters supported')).toBeVisible()
  await expect(params(page).getByLabel('Stroke thickness')).toHaveAttribute('aria-valuetext', '130')
  await page.getByRole('button', { name: 'Glyphs', exact: true }).click()
  await expect(page.getByRole('button', { name: 'H, supported, has overrides' })).toBeVisible() // advance override survived
  // Saving the migrated project writes schema v2.
  await params(page).getByLabel('Stroke thickness').focus()
  await page.keyboard.press('ArrowRight')
  await saved(page)
  const stored = (await readProjects(page)).find((p) => p['id'] === 'legacy-1')!
  expect(stored['schemaVersion']).toBe(2)
  expect(stored['customTypeface'].license).toEqual({ name: 'OFL-1.1', verified: true })
  expect(stored['customTypeface'].glyphs).toBeUndefined()
})
