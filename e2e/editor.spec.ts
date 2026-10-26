import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import * as fontkit from 'fontkit'
import { createProject, readProjects, saved } from './helpers'

async function startTypeface(page: Page, family: 'Geometric' | 'Rounded' | 'Modular' = 'Geometric') {
  await createProject(page, 'Editor test', 'Custom Typeface Creator')
  await page.getByRole('button', { name: new RegExp(`Start with ${family}`) }).click()
  await expect(page.getByLabel('Typeface name')).toBeVisible()
}

async function openGlyph(page: Page, char: string) {
  await page.getByRole('button', { name: 'Glyphs', exact: true }).click()
  await page.getByRole('button', { name: new RegExp(`^${char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, supported`) }).click()
  const canvas = page.getByRole('application', { name: `Outline of ${char}` })
  await expect(canvas).toBeVisible()
  return canvas
}

const status = (page: Page) => page.getByRole('status').filter({ hasText: /^(Point \d|No point|\d+ points)/ })
const storedGlyph = async (page: Page, char: string) => (await readProjects(page))[0]!['customTypeface'].overrides[char]

test.describe('glyph editor', () => {
  test('edit a point from the keyboard, undo and redo, apply, and keep it after a reload', async ({ page }) => {
    await startTypeface(page)
    const canvas = await openGlyph(page, 'H')
    await expect(page.getByText('Generated shape', { exact: true })).toBeVisible()
    await canvas.focus()
    await page.keyboard.press(']')
    await expect(status(page)).toContainText('Point 1 of')
    const before = await status(page).innerText()
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
    await expect(page.getByText('Unapplied changes', { exact: true })).toBeVisible()
    const x0 = Number(/x (-?\d+)/.exec(before)![1])
    await expect(status(page)).toContainText(`x ${x0 + 5}`)

    // Five held-down nudges are one undo step.
    await page.keyboard.press('Control+KeyZ')
    await expect(status(page)).toContainText(`x ${x0},`)
    await expect(page.getByText('Generated shape', { exact: true })).toBeVisible() // back to what the project holds: nothing unapplied
    await page.keyboard.press('Control+Shift+KeyZ')
    await expect(status(page)).toContainText(`x ${x0 + 5}`)

    await page.getByRole('button', { name: 'Apply changes' }).click()
    await expect(page.getByText('Hand-edited outline', { exact: true })).toBeVisible()
    await saved(page)
    const o = await storedGlyph(page, 'H')
    expect(o.contours[0][0].x).toBe(x0 + 5)
    expect(o.advanceWidth).toBeGreaterThan(0)

    // The address keeps the glyph, so a reload lands back in the editor with the edit in place.
    await page.reload()
    await expect(page.getByRole('application', { name: 'Outline of H' })).toBeVisible()
    await expect(page.getByText('Hand-edited outline', { exact: true })).toBeVisible()
    await expect(page.getByText('Unapplied changes', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'All glyphs' }).click()
    await expect(page.getByRole('button', { name: 'H, supported, has overrides' })).toBeVisible()
  })

  test('unapplied work is never lost silently: moving on asks first, and discarding really discards', async ({ page }) => {
    await startTypeface(page)
    const canvas = await openGlyph(page, 'H')
    await canvas.focus()
    await page.keyboard.press(']')
    await page.keyboard.press('ArrowUp')
    await page.getByRole('button', { name: 'Next glyph, I' }).click()
    const ask = page.getByRole('alert').filter({ hasText: 'has changes that are not applied' })
    await expect(ask).toBeVisible()
    await expect(page.getByRole('application', { name: 'Outline of H' })).toBeVisible() // still here
    await ask.getByRole('button', { name: 'Keep editing' }).click()
    await expect(ask).toBeHidden()

    // Leaving through the project navigation asks too.
    await page.getByRole('link', { name: 'Overview' }).click()
    const leave = page.getByRole('alert').filter({ hasText: 'outline changes that are not applied' })
    await expect(leave).toBeVisible()
    await leave.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page.getByRole('application', { name: 'Outline of H' })).toBeVisible()

    await page.getByRole('button', { name: 'Next glyph, I' }).click()
    await page.getByRole('alert').getByRole('button', { name: 'Discard and continue' }).click()
    await expect(page.getByRole('application', { name: 'Outline of I' })).toBeVisible()
    await saved(page)
    expect(await storedGlyph(page, 'H')).toBeUndefined()
  })

  test('apply and continue stores the edit and moves on', async ({ page }) => {
    await startTypeface(page)
    const canvas = await openGlyph(page, 'H')
    await canvas.focus()
    await page.keyboard.press(']')
    await page.keyboard.press('ArrowRight')
    await page.getByRole('button', { name: 'Next glyph, I' }).click()
    await page.getByRole('alert').getByRole('button', { name: 'Apply and continue' }).click()
    await expect(page.getByRole('application', { name: 'Outline of I' })).toBeVisible()
    await saved(page)
    expect((await storedGlyph(page, 'H')).contours).toBeDefined()
  })

  test('leaving through the project navigation can apply the work', async ({ page }) => {
    await startTypeface(page)
    const canvas = await openGlyph(page, 'H')
    await canvas.focus()
    await page.keyboard.press(']')
    await page.keyboard.press('ArrowRight')
    await page.getByRole('link', { name: 'Overview' }).click()
    await page.getByRole('alert').getByRole('button', { name: 'Apply and leave' }).click()
    await expect(page).toHaveURL(/\/projects\/[^/]+$/)
    await saved(page)
    expect((await storedGlyph(page, 'H')).contours).toBeDefined()
  })

  test('drag a point with the pointer; zoom and pan change the view but not the glyph', async ({ page }) => {
    await startTypeface(page)
    const canvas = await openGlyph(page, 'H')
    const point = page.locator('[data-pt="0:0"]')
    const box = (await point.boundingBox())!
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx - 30, cy - 30, { steps: 6 })
    await page.mouse.up()
    await expect(page.getByText('Unapplied changes', { exact: true })).toBeVisible()
    await expect(status(page)).toContainText('Point 1 of')
    const dragged = await status(page).innerText()

    const zoom = page.getByLabel('Zoom', { exact: true })
    const z0 = await zoom.innerText()
    await page.getByRole('button', { name: 'Zoom in' }).click()
    expect(await zoom.innerText()).not.toBe(z0)
    await page.getByRole('button', { name: 'Pan the view' }).click()
    const p1 = (await page.locator('[data-pt="0:1"]').boundingBox())!
    await page.mouse.move(p1.x + 4, p1.y + 4)
    await page.mouse.down()
    await page.mouse.move(p1.x + 60, p1.y + 40, { steps: 4 })
    await page.mouse.up()
    const p1after = (await page.locator('[data-pt="0:1"]').boundingBox())!
    expect(Math.abs(p1after.x - p1.x)).toBeGreaterThan(20) // the view moved
    expect(await status(page).innerText()).toBe(dragged) // the glyph did not
    await page.getByRole('button', { name: 'Fit the glyph in the view' }).click()
    await expect(canvas).toBeVisible()
  })

  test('insert and delete points by button, with the reasons when a delete is refused', async ({ page }) => {
    await startTypeface(page)
    const canvas = await openGlyph(page, 'H')
    await canvas.focus()
    await page.keyboard.press(']')
    const n = Number(/of (\d+) in contour/.exec(await status(page).innerText())![1])
    await page.getByRole('button', { name: 'Insert a point after the selected point' }).click()
    await expect(status(page)).toContainText(`Point 2 of ${n + 1}`)
    await page.getByRole('button', { name: 'Delete the selected points' }).click()
    await expect(page.getByText('Point deleted.')).toBeVisible()
    await page.keyboard.press('Control+KeyZ')
    await page.keyboard.press('Control+KeyZ')
    await expect(page.getByText('Generated shape', { exact: true })).toBeVisible()

    // Deleting some of a rectangle's points would leave a contour with fewer than three.
    await page.keyboard.press('Control+KeyA')
    await page.keyboard.press('Escape')
    await page.keyboard.press(']')
    await page.keyboard.press('Delete')
    await page.keyboard.press('Delete')
    await expect(page.getByText(/at least three points|Point deleted/).first()).toBeVisible()
  })

  test('an outline that crosses itself is reported, can still be applied, blocks export, and can be reset', async ({ page }) => {
    await startTypeface(page)
    const canvas = await openGlyph(page, 'H')
    await canvas.focus()
    await page.keyboard.press(']')
    // Type an X far across the glyph: the outline now crosses itself.
    const inspector = page.getByRole('complementary', { name: 'Inspector for H' })
    await inspector.getByLabel('X', { exact: true }).fill('600')
    await expect(inspector).toContainText('Blocks export')
    await expect(inspector).toContainText('crosses or touches itself')
    await page.getByRole('button', { name: 'Apply changes' }).click()
    await saved(page)
    await page.getByRole('button', { name: 'All glyphs' }).click()
    await expect(page.getByRole('button', { name: 'H, error, has overrides' })).toBeVisible()
    await page.getByRole('link', { name: 'Export…' }).click()
    await page.getByRole('button', { name: /Check and build/ }).click()
    const drawer = page.getByRole('complementary', { name: 'Font export' })
    await expect(drawer).toContainText('Export blocked')
    await expect(drawer.getByRole('button', { name: /Download/ })).toHaveCount(0)
    await drawer.getByRole('button', { name: 'Close Font export' }).click()

    // Recover: back in the editor, reset to the generated shape and apply.
    await page.goBack()
    await page.getByRole('button', { name: 'H, error, has overrides' }).click()
    await page.getByRole('button', { name: 'Reset to generated shape' }).click()
    await page.getByRole('button', { name: 'Apply changes' }).click()
    await saved(page)
    expect(await storedGlyph(page, 'H')).toBeUndefined()
    await page.getByRole('button', { name: 'All glyphs' }).click()
    await expect(page.getByRole('button', { name: 'H, supported', exact: true })).toBeVisible()
  })

  test('spacing: a glyph that follows the design stores bearings as overrides; a hand-edited one edits its working copy', async ({ page }) => {
    await startTypeface(page)
    await openGlyph(page, 'H')
    const inspector = page.getByRole('complementary', { name: 'Inspector for H' })
    const adv = inspector.getByLabel('Advance width')
    const a0 = Number(await adv.inputValue())

    // Still following the design: the bearing becomes a stored override and nothing is left unapplied.
    await inspector.getByLabel('Left bearing').fill('90')
    await expect(adv).toHaveValue(String(a0 + 30))
    await expect(page.getByText('Unapplied changes', { exact: true })).toHaveCount(0)
    await saved(page)
    expect((await storedGlyph(page, 'H')).leftBearing).toBe(90)
    await inspector.getByRole('button', { name: 'Follow automatic spacing' }).click()
    await expect(adv).toHaveValue(String(a0))

    // Once the outline is hand-edited, the same fields change the working copy: the outline moves, the advance follows.
    const canvas = page.getByRole('application', { name: 'Outline of H' })
    await canvas.focus()
    await page.keyboard.press(']')
    await page.keyboard.press('ArrowRight')
    await expect(page.getByText('Unapplied changes', { exact: true })).toBeVisible()
    const a1 = Number(await adv.inputValue())
    await inspector.getByLabel('Left bearing').fill('90')
    await expect(adv).toHaveValue(String(a1 + 30))
    await expect(inspector).toContainText('part of the working copy')
  })

  test('is operable on a phone-sized screen without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await startTypeface(page)
    await openGlyph(page, 'H')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect(page.getByRole('button', { name: 'Apply changes' })).toBeDisabled()
  })

  test('has no serious accessibility violations in the editor, preview, quality and info views', async ({ page }) => {
    await startTypeface(page)
    const check = async (label: string) => {
      const r = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
      expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${label}: ${v.id}`)).toEqual([])
    }
    await openGlyph(page, 'H')
    await check('editor')
    await page.getByRole('button', { name: 'All glyphs' }).click()
    await page.getByRole('button', { name: 'Preview', exact: true }).click()
    await expect(page.getByTestId('exported-preview')).toHaveAttribute('data-font-state', 'ready')
    await check('preview')
    await page.getByRole('button', { name: 'Quality', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Findings' })).toBeVisible()
    await check('quality')
    await page.getByRole('button', { name: 'Font info', exact: true }).click()
    await check('info')
  })
})

test.describe('text preview', () => {
  test('the exported file is drawn by the browser, matches the editor preview, and follows edits and settings', async ({ page }) => {
    await startTypeface(page, 'Rounded')
    // Edit H so the comparison covers hand-edited outlines too.
    const canvas = await openGlyph(page, 'H')
    await canvas.focus()
    await page.keyboard.press(']')
    for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight')
    await page.getByRole('button', { name: 'Apply changes' }).click()
    await page.getByRole('button', { name: 'All glyphs' }).click()
    await page.getByRole('button', { name: 'Preview', exact: true }).click()

    const exported = page.getByTestId('exported-preview')
    await expect(exported).toHaveAttribute('data-font-state', 'ready')
    await expect(page.getByRole('img', { name: /^Editor preview:/ })).toBeVisible()
    await page.getByLabel('Preview text').fill('HAMBURG Hand')
    await expect(exported).toHaveText('HAMBURG Hand')

    await page.getByRole('button', { name: 'Compare preview with exported file' }).click()
    const result = page.getByTestId('rendering-result')
    await expect(result).toContainText('Widths match.')
    await expect(result).toContainText('Shapes match.')

    // Specimens and the controls that only change the preview.
    await page.getByText('Alphabet', { exact: true }).click()
    await expect(page.getByLabel('Preview text')).toHaveValue(/^ABCDEFGHIJKLMNOPQRSTUVWXYZ/)
    const path = () => page.getByRole('img', { name: /^Editor preview:/ }).locator('path').nth(1).getAttribute('transform')
    const t0 = await path()
    const tracking = page.getByLabel('Letter spacing')
    await tracking.focus()
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight')
    expect(await path()).not.toBe(t0)
    await expect(exported).toHaveCSS('letter-spacing', /px/)
    await page.getByRole('slider', { name: 'Size', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(exported).toHaveCSS('font-size', '66px')

    await page.getByText('Exported file', { exact: true }).click()
    await expect(page.getByRole('img', { name: /^Editor preview:/ })).toHaveCount(0)
    await expect(exported).toBeVisible()
  })

  test('says which characters are not in the typeface', async ({ page }) => {
    await startTypeface(page)
    await page.getByRole('button', { name: 'Preview', exact: true }).click()
    await page.getByLabel('Preview text').fill('Fish & chips')
    await expect(page.getByRole('status').filter({ hasText: 'Not in this typeface' })).toContainText('&')
  })
})

test.describe('quality checks and font information', () => {
  test('findings explain themselves, offer fixes that work, and a fix for kerning is exported and applied', async ({ page }) => {
    await startTypeface(page)
    await page.getByRole('button', { name: 'Quality', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Quality checks' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Summary' })).toContainText('0 blocking')
    await expect(page.getByText('no overall score', { exact: false })).toBeVisible()
    await expect(page.getByRole('list', { name: 'What held' })).toContainText('required tables are present')

    const kerning = page.getByRole('article', { name: 'Pairs that usually need kerning' })
    await expect(kerning).toBeVisible()
    await expect(kerning).toContainText('Why it matters.')
    await kerning.getByText(/^Measurements/).click()
    await expect(kerning).toContainText('average gap')
    await kerning.getByRole('button', { name: /^Add the suggested kerning/ }).click()
    await expect(page.getByText(/^Applied: Add the suggested kerning/)).toBeVisible()
    await expect(page.getByRole('article', { name: 'Pairs that usually need kerning' })).toHaveCount(0)
    await expect(page.getByRole('list', { name: 'What held' })).toContainText('kerning pairs are in the file')
    await saved(page)
    const kern = (await readProjects(page))[0]!['customTypeface'].kerning as Array<{ left: string; right: string; value: number }>
    expect(kern.length).toBeGreaterThan(5)

    // The pairs reach the exported file and change how it lays out text.
    await page.getByRole('link', { name: 'Export…' }).click()
    await page.getByRole('button', { name: /Check and build/ }).click()
    const drawer = page.getByRole('complementary', { name: 'Font export' })
    const [download] = await Promise.all([page.waitForEvent('download'), drawer.getByRole('button', { name: /Download/ }).click()])
    const font = fontkit.create(readFileSync(await download.path())) as fontkit.Font
    const av = kern.find((k) => k.left === 'A' && k.right === 'V')
    expect(av).toBeDefined()
    const run = font.layout('AV')
    expect(run.positions[0]!.xAdvance).toBe(font.glyphForCodePoint(65).advanceWidth + av!.value)
  })

  test('an unnamed, unlicensed typeface is flagged; filling in the font info clears it and reaches the file', async ({ page }) => {
    await startTypeface(page)
    await page.getByRole('button', { name: 'Quality', exact: true }).click()
    for (const t of ['Placeholder family name', 'No copyright notice', 'No licence chosen']) await expect(page.getByRole('article', { name: t })).toBeVisible()

    await page.getByRole('article', { name: 'No licence chosen' }).getByRole('button', { name: 'Choose a licence' }).click()
    await expect(page.getByRole('heading', { name: 'Copyright and licence' })).toBeVisible()
    await page.getByLabel('Family name').fill('Bergamo Display')
    await page.getByLabel('Copyright notice').fill('Copyright 2026 Bergamo Studio')
    await page.getByLabel('Licence', { exact: true }).selectOption({ label: 'SIL Open Font License 1.1' })
    await expect(page.getByLabel('Licence link')).toHaveValue('https://openfontlicense.org')
    await page.getByLabel('Licence link').fill('not a link')
    await expect(page.getByText('Enter a full web address')).toBeVisible()
    await page.getByLabel('Licence link').fill('https://openfontlicense.org')
    await page.getByLabel(/I have read this licence/).check()
    await expect(page.getByText('PostScript name', { exact: true })).toBeVisible()
    await expect(page.getByText('BergamoDisplay-Regular')).toBeVisible()
    await saved(page)

    await page.getByRole('button', { name: 'Quality', exact: true }).click()
    for (const t of ['Placeholder family name', 'No copyright notice', 'No licence chosen', 'Licence not confirmed', 'No licence link']) await expect(page.getByRole('article', { name: t })).toHaveCount(0)

    await page.getByRole('link', { name: 'Export…' }).click()
    await page.getByRole('button', { name: /Check and build/ }).click()
    const drawer = page.getByRole('complementary', { name: 'Font export' })
    await expect(drawer).toContainText('Name table matches the project')
    const [download] = await Promise.all([page.waitForEvent('download'), drawer.getByRole('button', { name: /Download/ }).click()])
    const font = fontkit.create(readFileSync(await download.path())) as fontkit.Font
    expect(font.familyName).toBe('Bergamo Display')
    expect(font.copyright).toBe('Copyright 2026 Bergamo Studio')
    expect((font as unknown as { name: { records: Record<string, Record<string, string> | undefined> } }).name.records['license']?.['en']).toBe('SIL Open Font License 1.1')
  })
})

test.describe('font export formats', () => {
  test.beforeEach(async ({ page }) => {
    // Remember the media type of every Blob handed to a download link.
    await page.addInitScript(() => {
      const w = window as unknown as { __blobTypes: string[] }
      w.__blobTypes = []
      const original = URL.createObjectURL.bind(URL)
      URL.createObjectURL = (obj: Blob | MediaSource) => {
        if (obj instanceof Blob) w.__blobTypes.push(obj.type)
        return original(obj)
      }
    })
  })

  for (const [label, ext, mime, magic] of [
    ['TrueType', '.ttf', 'font/ttf', [0, 1, 0, 0]],
    ['OpenType, CFF', '.otf', 'font/otf', [0x4f, 0x54, 0x54, 0x4f]],
  ] as const) {
    test(`${ext}: right file name, media type and signature; a real font; recorded in the history`, async ({ page }) => {
      await startTypeface(page, 'Rounded')
      await page.getByLabel('Typeface name').fill('Export Check')
      await page.getByRole('link', { name: 'Export…' }).click()
      await page.getByText(label, { exact: false }).first().click()
      await page.getByRole('button', { name: new RegExp(`Check and build \\${ext}`) }).click()
      const drawer = page.getByRole('complementary', { name: 'Font export' })
      await expect(drawer).toContainText(`Built a`)
      await expect(drawer).toContainText(mime)
      const [download] = await Promise.all([page.waitForEvent('download'), drawer.getByRole('button', { name: new RegExp(`Download ExportCheck-Regular\\${ext}`) }).click()])
      expect(download.suggestedFilename()).toBe(`ExportCheck-Regular${ext}`)
      const bytes = readFileSync(await download.path())
      expect([...bytes.subarray(0, 4)]).toEqual(magic)
      const types = await page.evaluate(() => (window as unknown as { __blobTypes: string[] }).__blobTypes)
      expect(types).toContain(mime)
      const font = fontkit.create(bytes) as fontkit.Font
      expect(font.familyName).toBe('Export Check')
      expect(font.numGlyphs).toBe(91)
      await saved(page)
      await expect(page.getByText(`ExportCheck-Regular${ext}`).first()).toBeVisible()
      const history = (await readProjects(page))[0]!['exportHistory']
      expect(history[0].kind).toBe(ext === '.ttf' ? 'font-ttf' : 'font-otf')
    })
  }

  test('switching format clears a previous result and WOFF is not offered', async ({ page }) => {
    await startTypeface(page)
    await page.getByRole('link', { name: 'Export…' }).click()
    await expect(page.getByRole('radio', { name: /woff/i })).toHaveCount(0)
    await expect(page.getByText('WOFF and WOFF2 are not offered')).toBeVisible()
  })

  test('a failure during export is reported and recoverable: no file, nothing recorded, and a retry works', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __failDigest: boolean }
      w.__failDigest = true
      const original = crypto.subtle.digest.bind(crypto.subtle)
      crypto.subtle.digest = ((...args: Parameters<typeof original>) => (w.__failDigest ? Promise.reject(new Error('digest unavailable')) : original(...args))) as typeof original
    })
    await startTypeface(page)
    await saved(page)
    await page.getByRole('link', { name: 'Export…' }).click()
    await page.getByRole('button', { name: /Check and build/ }).click()
    await expect(page.getByRole('region', { name: 'Font file formats' }).getByRole('alert')).toContainText('Your project is unchanged')
    await expect(page.getByRole('button', { name: /^Download .*\.(ttf|otf)$/ })).toHaveCount(0)
    expect((await readProjects(page))[0]!['exportHistory']).toEqual([])
    expect((await readProjects(page))[0]!['customTypeface']).not.toBeNull()

    await page.evaluate(() => { (window as unknown as { __failDigest: boolean }).__failDigest = false })
    await page.getByRole('button', { name: /Check and build/ }).click()
    const drawer = page.getByRole('complementary', { name: 'Font export' })
    await expect(drawer).toContainText('Built a TrueType (.ttf) file')
    await expect(drawer.getByRole('button', { name: /Download/ })).toBeVisible()
  })
})
