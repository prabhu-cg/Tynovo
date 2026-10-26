import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { cardAction, createProject, readProjects, saved, writeProjects } from './helpers'

const name = (page: Page) => page.getByRole('main').getByRole('textbox', { name: 'Project name', exact: true })
const fontOf = (page: Page, role: string) => page.getByLabel(`Font of ${role}`, { exact: true })
/** Width of the text itself (not of its box), so a change in letter shapes shows. */
const textWidth = (loc: Locator) => loc.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect().width })
const fontStatus = (page: Page) => page.getByTestId('custom-font-status')

async function download(page: Page, button: string): Promise<{ text: string; bytes: Buffer; filename: string }> {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: button, exact: true }).click()])
  const path = await dl.path()
  return { text: readFileSync(path, 'utf8'), bytes: readFileSync(path), filename: dl.suggestedFilename() }
}

/** Project with a typeface named "Northwind Sans" and Display + Heading set in it, Body in Manrope. */
async function integrated(page: Page, project = 'Northwind') {
  await createProject(page, project, 'Custom Typeface Creator')
  await page.getByRole('button', { name: /Start with Geometric/ }).click()
  await page.getByLabel('Typeface name').fill('Northwind Sans')
  await saved(page)
  await page.getByRole('link', { name: 'Brand Typography System' }).click()
  await fontOf(page, 'Display').selectOption('custom')
  await fontOf(page, 'Heading').selectOption('custom')
  await fontOf(page, 'Body').selectOption({ label: 'Manrope' })
  // The custom typeface has one weight; use it rather than a synthesised bold.
  for (const role of ['Display', 'Heading']) await page.getByLabel(`Weight of ${role}`).fill('400')
  await saved(page)
}

test('one project carries a custom typeface from design to preview to export', async ({ page }) => {
  await integrated(page)

  // Existing and custom assignments are distinguishable, in words and in markup.
  const display = page.getByRole('listitem', { name: 'Display' })
  const body = page.getByRole('listitem', { name: 'Body' })
  await expect(display.locator('[data-origin="custom"]')).toHaveText('Custom typeface')
  await expect(body.locator('[data-origin="catalog"]')).toHaveText('Existing font, bundled')
  await expect(display.locator('[data-verdict="suitable"]')).toBeVisible()

  // The generated font is registered with the browser, and the previews really use it.
  await expect(fontStatus(page)).toHaveAttribute('data-state', 'ready')
  const registered = await page.evaluate(() => [...document.fonts].filter((f) => f.family.includes('BTS Custom')).map((f) => f.status))
  expect(registered).toEqual(['loaded'])
  const preview = page.getByTestId('brand-preview')
  const headline = preview.locator('[data-slot="headline"]')
  await expect(headline).toHaveAttribute('data-font-origin', 'custom')
  await expect(preview.locator('[data-slot="body"]')).toHaveAttribute('data-font-origin', 'catalog')
  expect(await headline.evaluate((e) => getComputedStyle(e).fontFamily)).toContain('BTS Custom')
  const rev1 = Number(await preview.getAttribute('data-custom-font-revision'))
  expect(rev1).toBeGreaterThan(0)

  // Changing the design changes the typography previews, without any reload or button.
  const displaySample = page.locator('[data-role-sample="Display"]')
  const widthBefore = await textWidth(displaySample)
  await page.getByRole('link', { name: 'Custom Typeface Creator', exact: true }).click()
  await expect(page.getByTestId('typeface-usage')).toContainText('Used in Display, Heading')
  const stroke = page.getByRole('slider', { name: 'Stroke thickness' })
  await stroke.focus()
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight')
  await saved(page)
  await page.getByRole('link', { name: 'Brand Typography System' }).click()
  await expect(async () => {
    expect(Number(await page.getByTestId('brand-preview').getAttribute('data-custom-font-revision'))).toBeGreaterThan(rev1)
  }).toPass()
  await expect(fontStatus(page)).toHaveAttribute('data-state', 'ready')
  await expect(async () => expect(await textWidth(displaySample)).not.toBe(widthBefore)).toPass() // heavier strokes, different widths

  // The export centre builds from the saved project and every file agrees with it.
  await page.getByRole('link', { name: 'Export', exact: true }).first().click()
  const sync = page.getByTestId('export-sync')
  await expect(sync).toContainText('Built from the saved project')
  const revision = (await sync.getAttribute('data-revision'))!
  expect(revision).toMatch(/^[0-9a-f]{12}$/)

  const lineHeight = (await readProjects(page))[0]!['typography'].roles[0].lineHeight
  const css = await download(page, 'Download CSS variables and font declarations')
  expect(css.filename).toBe('typography.css')
  expect(css.text).toContain(`project revision ${revision}`)
  expect(css.text).toContain('font-family: "Northwind Sans";')
  expect(css.text).toContain('src: url("fonts/NorthwindSans-Regular.ttf")')
  expect(css.text).toContain('--font-display: "Northwind Sans", sans-serif;')
  expect(css.text).toContain('--font-body: "Manrope", sans-serif;')
  expect(css.text).toContain(`--type-display-line-height: ${lineHeight};`)
  expect(css.text).toMatch(/NOT included/)
  await expect(page.getByTestId('external-font-note')).toContainText('Font files for Manrope are not included')

  const tokens = await download(page, 'Download Design tokens (JSON)')
  const t = JSON.parse(tokens.text)
  expect(t.$extensions['com.tynovo'].revision).toBe(revision)
  expect(t.typography.display.$value.fontFamily).toEqual(['Northwind Sans', 'sans-serif'])
  expect(t.typography.display.$value.fontWeight).toBe(400)
  expect(t.typography.display.$extensions['com.tynovo'].origin).toBe('custom')
  expect(t.typography.body.$extensions['com.tynovo'].origin).toBe('catalog')

  const spec = await download(page, 'Download Typography specification')
  expect(spec.text).toContain(`revision \`${revision}\``)
  expect(spec.text).toMatch(/\| Display \| Display \| Northwind Sans \| Custom typeface \|/)
  expect(spec.text).toMatch(/\| Body \| Body text \| Manrope \| Existing font, bundled \|/)

  const specimen = await download(page, 'Download HTML specimen')
  expect(specimen.text).toContain('data:font/ttf;base64,')
  expect(specimen.text).not.toMatch(/<script/i)

  const manifest = await download(page, 'Download Sources and licences')
  expect(manifest.text).toMatch(/Manrope \| Body \| Existing font, bundled \| SIL Open Font License 1.1/)
  expect(manifest.text).toMatch(/No file of a font made by someone else is included/)

  const font = await download(page, 'Download Custom font file (TTF)')
  expect(font.filename).toBe('NorthwindSans-Regular.ttf')
  expect([...font.bytes.subarray(0, 4)]).toEqual([0, 1, 0, 0])
  // The hash the manifest lists is the hash of the font that was downloaded.
  expect(manifest.text).toContain(`\`${createHash('sha256').update(font.bytes).digest('hex')}\``)

  const pkg = await download(page, 'Download Everything, as one package')
  expect(pkg.filename).toBe('northwind-typography.zip')
  expect(pkg.bytes.subarray(0, 2).toString()).toBe('PK')

  // Each download was recorded with the revision it came from, and all of them match the project right now.
  const history = page.getByRole('list', { name: 'Export history' })
  await expect(history.locator('[data-sync="current"]').first()).toBeVisible()
  await expect(history.locator('[data-sync="stale"]')).toHaveCount(0)

  // A later change marks earlier exports out of date.
  await page.getByRole('link', { name: 'Brand Typography System' }).click()
  await page.getByLabel('Line height of Body').fill('1.9')
  await saved(page)
  await page.getByRole('link', { name: 'Export', exact: true }).first().click()
  await expect(page.getByRole('list', { name: 'Export history' }).locator('[data-sync="stale"]').first()).toContainText('Out of date')
  await expect(page.getByTestId('export-sync')).not.toHaveAttribute('data-revision', revision)
  const css2 = await download(page, 'Download CSS variables and font declarations')
  expect(css2.text).toContain('--type-body-line-height: 1.9;')
})

test('reloading restores the linked configuration, and the font is registered again', async ({ page }) => {
  await integrated(page)
  const stored = (await readProjects(page))[0]!
  const faceId = stored['customTypeface'].id
  expect(stored['typography'].roles[0].font).toEqual({ kind: 'custom', typefaceId: faceId })
  expect(stored['typography'].roles[2].font.kind).toBe('source')
  expect(stored['fontSources']).toHaveLength(1) // the typeface is linked by id, not copied into the font list
  expect(stored['fontSources'][0].family).toBe('Manrope')

  await page.reload()
  await expect(fontOf(page, 'Display')).toHaveValue('custom')
  await expect(fontOf(page, 'Heading')).toHaveValue('custom')
  await expect(fontOf(page, 'Body')).not.toHaveValue('custom')
  await expect(page.getByRole('listitem', { name: 'Display' }).locator('[data-origin="custom"]')).toBeVisible()
  await expect(fontStatus(page)).toHaveAttribute('data-state', 'ready')
  expect(await page.evaluate(() => [...document.fonts].filter((f) => f.family.includes('BTS Custom')).length)).toBe(1)
})

test('exports wait for the save, so they never describe an unsaved draft', async ({ page }) => {
  await integrated(page)
  await page.getByRole('link', { name: 'Export', exact: true }).first().click()
  const specButton = page.getByRole('button', { name: 'Download Typography specification', exact: true })
  await expect(specButton).toBeEnabled()
  // Edit the name in the header: the draft is now ahead of what is saved.
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('Northwind renamed')
  await expect(page.getByText('You have changes that are not saved yet')).toBeVisible()
  await expect(specButton).toBeDisabled()
  await saved(page)
  await expect(specButton).toBeEnabled()
  const spec = await download(page, 'Download Typography specification')
  expect(spec.text.split('\n')[0]).toBe('# Northwind renamed: typography specification')
})

test('missing characters are shown where they occur and in the checks', async ({ page }) => {
  await integrated(page, 'Café Nørd')
  const preview = page.getByTestId('brand-preview')
  const warning = preview.getByText('The custom typeface cannot draw some characters in this preview.')
  await expect(warning).toBeVisible()
  await expect(preview.locator('[data-missing-role="Heading"]')).toContainText('é ø')
  await expect(preview.locator('[data-slot="brand"] [data-missing="é"]')).toBeVisible()
  // Words of the user's own change the warning; roles in an existing font are never warned about.
  await page.getByText('Change the sample text').click()
  await page.getByLabel('Headline').fill('Smörgåsbord')
  await expect(preview.locator('[data-missing-role="Display"]')).toContainText('ö å')
  await expect(preview.locator('[data-missing-role="Body"]')).toHaveCount(0)
  await page.getByLabel('Headline').fill('Plain words')
  await name(page).fill('Cafe Nord')
  await expect(warning).toHaveCount(0)

  await name(page).fill('Café')
  await saved(page)
  await page.getByRole('link', { name: 'Export', exact: true }).first().click()
  await expect(page.getByRole('list', { name: 'Checks before export' })).toContainText('previews contain characters the custom typeface lacks')
})

test('the custom typeface is only offered for roles it suits, with the reason', async ({ page }) => {
  await integrated(page)
  const caption = page.getByRole('listitem', { name: 'Caption' })
  await expect(caption.locator('option[value="custom"]')).not.toHaveAttribute('disabled')
  // At step -6 the type is about 4px: lowercase cannot be read.
  await page.getByLabel('Scale step of Caption').fill('-6')
  await saved(page)
  await fontOf(page, 'Caption').selectOption({ label: 'Manrope' })
  await expect(caption.locator('option[value="custom"]')).toHaveAttribute('disabled', '')
  await expect(caption.getByTestId('custom-blocked')).toContainText('Your typeface can’t be used for this role')
  await expect(caption.getByTestId('custom-blocked')).toContainText('too small to read')

  // A synthesised bold is allowed but flagged, with a one-click fix.
  await page.getByLabel('Weight of Heading').fill('700')
  const heading = page.getByRole('listitem', { name: 'Heading' })
  await expect(heading.locator('[data-verdict="caution"]')).toBeVisible()
  await expect(heading).toContainText('Browsers will thicken it artificially')
  await heading.getByRole('button', { name: 'Use weight 400' }).click()
  await expect(heading.locator('[data-verdict="suitable"]')).toBeVisible()
  await expect(page.getByLabel('Weight of Heading')).toHaveValue('400')
})

test('removing the typeface unassigns its roles after asking', async ({ page }) => {
  await integrated(page)
  await page.getByRole('link', { name: 'Custom Typeface Creator', exact: true }).click()
  await page.getByRole('button', { name: 'Remove typeface from project…' }).click()
  await expect(page.getByRole('group', { name: 'Confirm removing the typeface' })).toContainText('Display, Heading will have no font assigned')
  await page.getByRole('button', { name: 'Remove typeface', exact: true }).click()
  await saved(page)
  const stored = (await readProjects(page))[0]!
  expect(stored['customTypeface']).toBeNull()
  expect(stored['typography'].roles.map((r: { font: unknown }) => r.font === null)).toEqual([true, true, false, true, true])
  await page.getByRole('link', { name: 'Brand Typography System' }).click()
  await expect(page.getByRole('listitem', { name: 'Display' }).locator('[data-origin="none"]')).toBeVisible()
  await expect(page.getByRole('listitem', { name: 'Body' }).locator('[data-origin="catalog"]')).toBeVisible()
})

test('existing fonts named by the user are exported as references, with the file-supply explanation', async ({ page }) => {
  await createProject(page, 'Plain', 'Brand Typography System')
  await page.getByLabel('Add an existing font by name').fill('Helvetica Neue')
  await page.getByRole('button', { name: 'Add font' }).click()
  await fontOf(page, 'Body').selectOption({ label: 'Helvetica Neue' })
  await page.getByLabel('Licence of Helvetica Neue').fill('Commercial licence, 10 seats')
  await saved(page)
  await page.getByRole('link', { name: 'Export', exact: true }).first().click()
  await expect(page.getByTestId('export-sync')).toContainText('revision')
  await expect(page.getByTestId('external-font-note')).toContainText('Font files for Helvetica Neue are not included')
  await expect(page.getByRole('list', { name: 'Checks before export' })).toContainText('not included in exports')
  const css = await download(page, 'Download CSS variables and font declarations')
  expect(css.text).not.toMatch(/^@font-face \{/m)
  expect(css.text).toContain('--font-body: "Helvetica Neue", sans-serif;')
  expect(css.text).toMatch(/Helvetica Neue.*renders only where it is installed/)
  const fontRow = page.locator('[data-export="font"]')
  await expect(fontRow).toContainText('no custom typeface')
  await expect(fontRow.getByRole('button', { name: /Download/ })).toBeDisabled()
  const manifest = await download(page, 'Download Sources and licences')
  expect(manifest.text).toContain('| Helvetica Neue | Body | Existing font, by name | Commercial licence, 10 seats | no | no: supply separately |')
})

test('duplicating and deleting projects leave other projects intact; a backup restores a deleted one', async ({ page }) => {
  await integrated(page, 'Alpha')
  await page.getByRole('link', { name: 'Settings', exact: true }).last().click()
  await page.getByRole('button', { name: 'Duplicate this project' }).click()
  await expect(name(page)).toHaveValue('Alpha (copy)')

  // Change the copy only.
  await page.getByRole('link', { name: 'Brand Typography System' }).click()
  await fontOf(page, 'Display').selectOption('')
  await page.getByLabel('Line height of Body').fill('2.2')
  await saved(page)
  await page.goto('/app/projects')
  await page.getByRole('link', { name: 'Alpha', exact: true }).click()
  await page.getByRole('link', { name: 'Brand Typography System' }).click()
  await expect(fontOf(page, 'Display')).toHaveValue('custom')
  await expect(page.getByLabel('Line height of Body')).toHaveValue('1.55')

  // Delete the copy from the list, taking a backup first; the original and its typeface are untouched.
  await page.goto('/app/projects')
  await cardAction(page, 'Alpha (copy)', /^Delete/)
  const panel = page.getByRole('group', { name: 'Confirm deleting Alpha (copy)' })
  await expect(panel).toContainText('cannot be brought back')
  const [backup] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name: 'Download a backup first' }).click()])
  expect(backup.suggestedFilename()).toBe('alpha-copy.tynovo.json')
  const backupPath = await backup.path()
  expect(JSON.parse(readFileSync(backupPath, 'utf8')).project.customTypeface.familyName).toBe('Northwind Sans')
  await expect(panel).toContainText('Backup saved as alpha-copy.tynovo.json')
  await panel.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Alpha (copy)' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Alpha', exact: true })).toBeVisible()
  const rows = await readProjects(page)
  expect(rows).toHaveLength(1)
  expect(rows[0]!['customTypeface'].familyName).toBe('Northwind Sans')

  // Importing the backup brings the deleted project back with its links.
  await page.locator('input[type=file]').setInputFiles(backupPath)
  await expect(page.getByRole('link', { name: 'Alpha (copy)' })).toBeVisible()
  await page.getByRole('link', { name: 'Alpha (copy)' }).click()
  await page.getByRole('link', { name: 'Brand Typography System' }).click()
  await expect(fontOf(page, 'Heading')).toHaveValue('custom')
  await expect(page.getByLabel('Line height of Body')).toHaveValue('2.2')
  await expect(fontOf(page, 'Display')).toHaveValue('')
})

test('a project stored by an older version is upgraded on opening, with the original kept', async ({ page }) => {
  await page.goto('/app/projects')
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible()
  const v2 = {
    schemaVersion: 2, id: 'v2-project', name: 'From version two', createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-02T00:00:00.000Z',
    brand: { personality: ['calm'], notes: '' },
    typography: {
      scale: { baseSizePx: 16, ratio: 1.25, stepsDown: 2, stepsUp: 6 },
      roles: [
        { id: 'r1', name: 'Display', fontSourceId: null, weight: 700, scaleStep: 6, lineHeight: 1.05, letterSpacingEm: -0.02 },
        { id: 'r2', name: 'Body', fontSourceId: 's1', weight: 400, scaleStep: 0, lineHeight: 1.55, letterSpacingEm: 0 },
      ],
    },
    fontSources: [{ id: 's1', family: 'Fraunces', kind: 'catalog', license: { name: 'SIL Open Font License 1.1', verified: true }, weights: [400] }],
    customTypeface: null, exportHistory: [],
  }
  await writeProjects(page, [v2])
  await page.reload()
  await page.getByRole('link', { name: 'From version two' }).click()
  const banner = page.getByRole('status').filter({ hasText: 'saved in an older format (version 2)' })
  await expect(banner).toBeVisible()
  expect((await readProjects(page))[0]!['schemaVersion']).toBe(2) // opening alone changes nothing on disk
  const [dl] = await Promise.all([page.waitForEvent('download'), banner.getByRole('button', { name: 'Download the original' }).click()])
  expect(JSON.parse(readFileSync(await dl.path(), 'utf8')).schemaVersion).toBe(2)

  await page.getByRole('link', { name: 'Brand Typography System' }).click()
  await expect(fontOf(page, 'Body')).toHaveValue(/^source:/) // the old link became a typed link
  await expect(page.getByRole('listitem', { name: 'Body' })).toContainText('Fraunces')
  await page.getByLabel('Weight of Body').fill('500')
  await saved(page)
  const stored = (await readProjects(page))[0]!
  expect(stored['schemaVersion']).toBe(4)
  expect(stored['typography'].roles[1].font).toEqual({ kind: 'source', sourceId: 's1' })
  expect(stored['typography'].roles[1].fontSourceId).toBeUndefined()
})

test('a damaged project can be recovered into a new one without touching the damaged record', async ({ page }) => {
  await page.goto('/app/projects')
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible()
  await writeProjects(page, [{
    schemaVersion: 3, id: 'broken-3', name: 'Half broken', createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-02T00:00:00.000Z',
    brand: { personality: ['calm'], notes: '' },
    typography: {
      scale: { baseSizePx: 16, ratio: 1.25, stepsDown: 2, stepsUp: 6 },
      roles: [
        { id: 'r1', name: 'Display', kind: 'display', font: { kind: 'source', sourceId: 'gone' }, weight: 700, scaleStep: 6, lineHeight: 1.05, letterSpacingEm: 0 },
        { id: 'r2', name: 'Body', kind: 'body', font: null, weight: 'heavy', scaleStep: 0, lineHeight: 1.5, letterSpacingEm: 0 },
      ],
    },
    fontSources: [], customTypeface: null, exportHistory: [{ nope: 1 }],
  }])
  await page.reload()
  await expect(page.getByText('Records that could not be opened')).toBeVisible()
  await page.getByRole('button', { name: 'Recover what can be read' }).click()
  const notice = page.getByRole('alert').filter({ hasText: 'Recovered “Half broken (recovered)”' })
  await expect(notice).toContainText('1 typography role could not be read')
  await expect(notice).toContainText('1 export history entry could not be read')
  await expect(notice).toContainText('1 role pointed at a font that could not be recovered')
  await expect(page.getByRole('link', { name: 'Half broken (recovered)' })).toBeVisible()
  expect((await readProjects(page)).map((r) => r['id']).includes('broken-3')).toBe(true) // the damaged record is still there
  await page.getByRole('link', { name: 'Half broken (recovered)' }).click()
  await expect(name(page)).toHaveValue('Half broken (recovered)')
  await page.getByRole('link', { name: 'Brand Typography System' }).click()
  await expect(fontOf(page, 'Display')).toHaveValue('')
})

test('the overview shows where the shared workflow stands', async ({ page }) => {
  await createProject(page, 'Flow')
  const flow = page.getByRole('list', { name: 'Brand workflow' })
  await expect(flow.locator('[data-step="brand"]')).toHaveAttribute('data-state', 'todo')
  await expect(flow.locator('[data-step="typeface"]')).toHaveAttribute('data-state', 'optional')
  await expect(flow.locator('[data-step="export"]')).toHaveAttribute('data-state', 'todo')
  await page.getByLabel('Add a personality trait').fill('precise')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(flow.locator('[data-step="brand"]')).toHaveAttribute('data-state', 'done')
  await expect(flow.locator('[data-step="validate"]')).toHaveAttribute('data-state', 'attention') // roles without fonts
})

test('typography and export screens have no serious accessibility violations', async ({ page }) => {
  await integrated(page, 'Café')
  await expect(fontStatus(page)).toHaveAttribute('data-state', 'ready')
  const check = async (where: string) => {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${where}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
  }
  await check('typography')
  await page.getByRole('link', { name: 'Export', exact: true }).first().click()
  await expect(page.getByTestId('export-sync')).toContainText('revision')
  await page.getByRole('button', { name: 'Show contents' }).first().click()
  await check('export')
  await page.goto(page.url().replace(/export$/, ''))
  await check('overview')
})
