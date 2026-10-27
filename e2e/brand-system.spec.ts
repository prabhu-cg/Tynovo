import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createProject, readProjects, saved, writeProjects } from './helpers'

const fontOf = (page: Page, role: string) => page.getByLabel(`Font of ${role}`, { exact: true })
const tab = (page: Page, name: string) => page.getByRole('link', { name, exact: true }).first()

async function download(page: Page, button: string) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: button, exact: true }).click()])
  return { text: readFileSync(await dl.path(), 'utf8'), filename: dl.suggestedFilename() }
}

/** Faces the page has registered for a family, with their state. */
const faces = (page: Page, family: string) =>
  page.evaluate((f) => [...document.fonts].filter((x) => x.family.replace(/"/g, '') === f).map((x) => `${x.weight}/${x.style}/${x.status}`), family)

async function brandDirection(page: Page) {
  await page.getByLabel('Brand name').fill('Northwind Labs')
  await page.getByLabel('Description').fill('Planning software for small logistics teams.')
  await page.getByText('SaaS and software', { exact: true }).click()
  await page.getByText('Technical', { exact: true }).click()
  await page.getByText('Confident', { exact: true }).click()
  const readability = page.getByRole('slider', { name: 'Readability priority' })
  await readability.focus()
  await page.keyboard.press('End')
  await saved(page)
}

test('brand direction is defined, saved, survives a refresh and reaches the specification', async ({ page }) => {
  await createProject(page, 'Northwind')
  await brandDirection(page)
  await page.reload()
  await expect(page.getByLabel('Brand name')).toHaveValue('Northwind Labs')
  await expect(page.getByLabel('Description')).toHaveValue('Planning software for small logistics teams.')
  await expect(page.getByRole('checkbox', { name: 'SaaS and software' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Technical' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Editorial' })).not.toBeChecked()
  await expect(page.getByRole('slider', { name: 'Readability priority' })).toHaveValue('5')
  const stored = (await readProjects(page))[0]!['brand']
  expect(stored).toMatchObject({ name: 'Northwind Labs', useCases: ['saas'], tones: expect.arrayContaining(['confident', 'technical']), readabilityPriority: 5, displayPriority: 3 })

  await expect(page.getByRole('list', { name: 'Brand workflow' }).locator('[data-step="brand"]')).toHaveAttribute('data-state', 'done')
  await page.getByRole('link', { name: 'Export', exact: true }).first().click()
  await expect(page.getByTestId('export-sync')).toContainText('revision')
  const spec = await download(page, 'Download Typography specification')
  expect(spec.text.split('\n')[0]).toBe('# Northwind Labs: typography specification')
  expect(spec.text).toContain('Planning software for small logistics teams.')
  expect(spec.text).toMatch(/Use cases: SaaS and software\./)
  expect(spec.text).toMatch(/Tone: .*Confident.*Technical|Tone: .*Technical.*Confident/)
  expect(spec.text).toContain('readability High (5 of 5), display use Medium (3 of 5)')
  const tokens = JSON.parse((await download(page, 'Download Design tokens (JSON)')).text)
  expect(tokens.$extensions['com.tynovo'].brand).toMatchObject({ name: 'Northwind Labs', useCases: ['saas'], readabilityPriority: 5 })
})

/** The filter chips live in a panel behind the Filter button; open it if it is not open, then pick a chip. */
async function filterChip(page: Page, label: string) {
  const panel = page.getByRole('dialog', { name: 'Filter fonts' })
  if (!(await panel.isVisible())) await page.getByRole('button', { name: /^Filter/ }).click()
  await panel.getByText(label, { exact: true }).click()
}

test('the catalog searches, filters and shows weights, styles, source and licence', async ({ page }) => {
  await createProject(page, 'Catalog')
  await tab(page, 'Font catalog').click()
  await expect(page.getByTestId('catalog-count')).toHaveText('24 of 24 fonts.')
  await page.getByLabel('Search by family name').fill('plex')
  await expect(page.getByTestId('catalog-count')).toHaveText('3 of 24 fonts match.')
  await expect(page.getByRole('list', { name: 'Fonts' }).getByRole('listitem')).toHaveCount(3)
  await filterChip(page, 'Monospace')
  await expect(page.getByTestId('catalog-count')).toHaveText('1 of 24 fonts match.')
  await expect(page.getByRole('list', { name: 'Fonts' })).toContainText('IBM Plex Mono')
  await page.getByLabel('Search by family name').fill('zzzz')
  await expect(page.getByRole('heading', { name: 'No font matches' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).first().click()
  await expect(page.getByTestId('catalog-count')).toHaveText('24 of 24 fonts.')

  // Category and tag filters narrow the list, and every row obeys them.
  await filterChip(page, 'Display')
  const rows = page.getByRole('list', { name: 'Fonts' }).getByRole('listitem')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toHaveAttribute('data-category', 'display')
  await page.getByRole('button', { name: 'Clear filters' }).first().click()
  await filterChip(page, 'Drawn for text')
  const n = await rows.count()
  expect(n).toBeGreaterThan(5)
  expect(n).toBeLessThan(24)

  await page.getByRole('button', { name: 'Clear filters' }).first().click()
  await page.getByRole('button', { name: 'Details of Lora' }).click()
  const detail = page.getByTestId('font-detail')
  await expect(detail).toHaveAttribute('data-font', 'Lora')
  await expect(detail.getByRole('link', { name: /SIL Open Font License 1.1/ })).toHaveAttribute('href', /openfontlicense\.org/)
  await expect(detail).toContainText('Copyright')
  await expect(detail).toContainText('normal and italic styles')
  await expect(detail.getByRole('group', { name: 'Weights' }).getByRole('button')).toHaveText(['400', '500', '600', '700', '400 italic'])
  await expect(detail.getByRole('link', { name: '@fontsource/lora' })).toBeVisible()
  await expect(detail).toContainText('read from the package’s metadata, not from a legal review')
})

test('catalog fonts load only when needed, from the app itself, and a bounded number stay loaded', async ({ page }) => {
  const origins = new Set<string>()
  page.on('request', (r) => origins.add(new URL(r.url()).origin))
  await createProject(page, 'Loading')
  await tab(page, 'Font catalog').click()
  expect(await faces(page, 'Inter')).toEqual([]) // nothing is fetched just for opening the catalog
  await page.getByRole('button', { name: 'Details of Inter' }).click()
  await expect(page.getByTestId('font-sample')).toHaveAttribute('data-state', 'loaded')
  expect(await faces(page, 'Inter')).toEqual(['400/normal/loaded'])
  await expect(page.getByTestId('font-availability')).toContainText('The 400 file is loaded from Tynovo')
  await page.getByRole('group', { name: 'Weights' }).getByRole('button', { name: '700', exact: true }).click()
  await expect(page.getByTestId('font-sample')).toHaveAttribute('data-weight', '700')
  await expect(async () => expect(await faces(page, 'Inter')).toContain('700/normal/loaded')).toPass()

  // Open many fonts one after another: the number of registered faces never grows without limit.
  const names = ['Lora', 'Manrope', 'DM Sans', 'Work Sans', 'Caveat', 'Space Mono', 'Fraunces', 'Merriweather', 'Public Sans', 'EB Garamond', 'Bebas Neue', 'Abril Fatface']
  for (const name of names) {
    await page.getByRole('button', { name: `Details of ${name}` }).click()
    await expect(page.getByTestId('font-sample')).toHaveAttribute('data-state', 'loaded')
  }
  const registered = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded' && !/Manrope Variable|Fraunces Variable/.test(f.family)).length)
  expect(registered).toBeLessThanOrEqual(8)
  expect(registered).toBeGreaterThan(0)
  expect([...origins]).toEqual([new URL(page.url()).origin]) // no request left the app
})

test('a font file that cannot be loaded is reported, not shown as available, and can be retried', async ({ page }) => {
  await createProject(page, 'Offline')
  await tab(page, 'Font catalog').click()
  await page.route('**/*.woff2', (route) => route.abort())
  await page.getByRole('button', { name: 'Details of Inter' }).click()
  const sample = page.getByTestId('font-sample')
  await expect(sample).toHaveAttribute('data-state', 'failed')
  await expect(page.getByRole('alert').filter({ hasText: 'The font file could not be loaded' })).toContainText('stand-in')
  await expect(page.getByTestId('font-availability')).toContainText('Not available: the file could not be loaded')
  expect(await faces(page, 'Inter')).toEqual([])
  // The rest of Tynovo keeps working while the file is unavailable.
  await page.getByLabel('Search by family name').fill('inter')
  await expect(page.getByTestId('catalog-count')).toHaveText('1 of 24 fonts match.')
  await page.unroute('**/*.woff2')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(sample).toHaveAttribute('data-state', 'loaded')
})

test('roles show whether their font is really loaded, and fail visibly rather than crash', async ({ page }) => {
  await createProject(page, 'Roles', 'Brand Typography System')
  await page.route('**/*.woff2', (route) => route.abort())
  await fontOf(page, 'Body').selectOption({ label: 'Lora' })
  const body = page.getByRole('listitem', { name: 'Body' })
  await expect(body.getByTestId('role-availability')).toHaveAttribute('data-status', 'failed')
  await expect(body.getByTestId('role-availability')).toContainText('Previews show the fallback (serif)')
  await expect(page.getByRole('region', { name: 'Fonts' }).or(page.locator('#fonts')).getByTestId('font-availability').first()).toHaveAttribute('data-status', 'failed')
  await saved(page)
  await page.getByRole('link', { name: 'Export', exact: true }).first().click()
  await expect(page.getByRole('list', { name: 'Checks before export' })).toContainText('Lora is used by Body, but could not be loaded')
  await page.unroute('**/*.woff2')
  await tab(page, 'Brand Typography System').click()
  await body.getByRole('button', { name: 'Try again' }).click()
  await expect(body.getByTestId('role-availability')).toHaveAttribute('data-status', 'loaded')
  expect(await faces(page, 'Lora')).toEqual(['400/normal/loaded'])
})

test('a named font is only called available when it is detected on this device', async ({ page }) => {
  await createProject(page, 'Named', 'Brand Typography System')
  await page.getByLabel('Add an existing font by name').fill('Zzyzx Not Installed Sans')
  await page.getByRole('button', { name: 'Add font' }).click()
  const missing = page.locator('[data-font-source="Zzyzx Not Installed Sans"]')
  await expect(missing.getByTestId('font-availability')).toHaveAttribute('data-status', 'not-detected')
  await expect(missing.getByTestId('font-availability')).toContainText('Not detected on this device, so previews show the fallback (sans-serif)')
  await fontOf(page, 'Body').selectOption({ label: 'Zzyzx Not Installed Sans' })
  await expect(page.getByRole('listitem', { name: 'Body' }).getByTestId('role-availability')).toHaveAttribute('data-status', 'not-detected')

  // A font that really is present on the device is detected. Register one under a made-up name to stand in for it.
  await tab(page, 'Font catalog').click()
  await page.getByRole('button', { name: 'Details of Inter' }).click()
  await expect(page.getByTestId('font-sample')).toHaveAttribute('data-state', 'loaded')
  await page.evaluate(async () => {
    const entry = performance.getEntriesByType('resource').find((r) => /inter-latin-400-normal.*\.woff2/.test(r.name))!
    const bytes = await (await fetch(entry.name)).arrayBuffer()
    const face = new FontFace('E2E Standin Sans', bytes)
    await face.load()
    document.fonts.add(face)
  })
  await page.getByRole('button', { name: 'Close Inter' }).click()
  await tab(page, 'Brand Typography System').click()
  await page.getByLabel('Add an existing font by name').fill('E2E Standin Sans')
  await page.getByRole('button', { name: 'Add font' }).click()
  const present = page.locator('[data-font-source="E2E Standin Sans"]')
  await expect(present.getByTestId('font-availability')).toHaveAttribute('data-status', 'installed')
  await expect(present.getByTestId('font-availability')).toContainText('Detected on this device')
  await expect(present.getByTestId('font-availability')).toContainText('exports do not include its file')

  await saved(page)
  await page.getByRole('link', { name: 'Export', exact: true }).first().click()
  await expect(page.getByRole('list', { name: 'Checks before export' })).toContainText('Zzyzx Not Installed Sans is used by Body, but not detected on this device')
})

test('a font that has left the catalog does not crash the project and is not shown as available', async ({ page }) => {
  await page.goto('/app/projects')
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible()
  await writeProjects(page, [
    {
      schemaVersion: 4, id: 'gone-1', name: 'Gone font', createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-02T00:00:00.000Z',
      brand: { name: '', description: '', personality: [], useCases: [], tones: [], readabilityPriority: 3, displayPriority: 3, notes: '', sampleCopy: {} },
      typography: {
        scale: { baseSizePx: 16, ratio: 1.25, stepsDown: 2, stepsUp: 6 },
        roles: [
          { id: 'r1', name: 'Display', kind: 'display', font: null, weight: 700, scaleStep: 6, lineHeight: 1.05, letterSpacingEm: 0 },
          { id: 'r2', name: 'Heading', kind: 'heading', font: null, weight: 600, scaleStep: 3, lineHeight: 1.2, letterSpacingEm: 0 },
          { id: 'r3', name: 'Body', kind: 'body', font: { kind: 'source', sourceId: 's1' }, weight: 400, scaleStep: 0, lineHeight: 1.5, letterSpacingEm: 0 },
          { id: 'r4', name: 'UI', kind: 'ui', font: null, weight: 500, scaleStep: 0, lineHeight: 1.3, letterSpacingEm: 0 },
        ],
        sizes: { headings: [5, 4, 3, 2, 1, 0], bodyLarge: 1, bodySmall: -1 },
        responsive: { enabled: false, minViewportPx: 320, maxViewportPx: 1280, minBaseSizePx: 14, minRatio: 1.125 },
        pairing: { primary: null, secondary: null },
        customFallback: { families: [], generic: 'sans-serif' },
      },
      fontSources: [{ id: 's1', family: 'Retired Display Sans', kind: 'catalog', license: { name: 'SIL Open Font License 1.1', verified: true }, weights: [400], fallback: 'sans-serif', fallbackFamilies: [] }],
      customTypeface: null, exportHistory: [],
    },
  ])
  await page.reload()
  await page.getByRole('link', { name: 'Gone font' }).click()
  await tab(page, 'Brand Typography System').click()
  const body = page.getByRole('listitem', { name: 'Body' })
  await expect(body.getByTestId('role-availability')).toHaveAttribute('data-status', 'unavailable')
  await expect(body.getByTestId('role-availability')).toContainText('no longer in Tynovo\'s catalog')
  await expect(page.getByTestId('brand-preview')).toBeVisible() // the editor still renders
  await saved(page)
  await page.getByRole('link', { name: 'Export', exact: true }).first().click()
  await expect(page.getByRole('list', { name: 'Checks before export' })).toContainText('Retired Display Sans is used by Body')
})

test('a pairing is chosen, applied to roles, and any role can still differ; it survives a refresh', async ({ page }) => {
  await createProject(page, 'Pairing')
  await brandDirection(page)
  await tab(page, 'Brand Typography System').click()
  const cards = page.getByRole('region', { name: 'Suggested pairings' }).locator('[data-pairing]')
  await expect(cards.first()).toBeVisible()
  expect(await cards.count()).toBeLessThanOrEqual(3)
  // Every point has its reason, and nothing claims what the rules cannot back.
  const text = (await page.getByRole('region', { name: 'Suggested pairings' }).textContent()) ?? ''
  expect(text).toMatch(/\+2 Tagged for a (technical|confident) tone/)
  expect(text).toMatch(/not an AI model and not a legibility or accessibility test/)
  expect(text).not.toMatch(/optimal|accessible pairing|best pairing/i)

  const first = cards.first()
  const label = (await first.getAttribute('data-pairing'))!
  const [primary, secondary] = label.split(' + ') as [string, string]
  await first.getByRole('button', { name: /^Use and apply/ }).click()
  await expect(page.getByTestId('pairing-status')).toHaveText('Every role follows the pairing.')
  await expect(page.getByLabel('Primary font (display and headings)')).toHaveText(new RegExp(primary))
  const sel = async (role: string) => await fontOf(page, role).evaluate((e: HTMLSelectElement) => e.selectedOptions[0]!.textContent)
  expect([await sel('Display'), await sel('Heading')]).toEqual([primary, primary])
  expect([await sel('Body'), await sel('UI'), await sel('Caption')]).toEqual([secondary, secondary, secondary])

  await fontOf(page, 'Caption').selectOption('')
  await expect(page.getByTestId('pairing-status')).toHaveText('1 role differs from the pairing: Caption.')
  await page.getByRole('button', { name: 'Apply pairing to roles' }).click()
  await expect(page.getByTestId('pairing-status')).toHaveText('Every role follows the pairing.')
  await fontOf(page, 'Heading').selectOption({ label: secondary })
  await saved(page)
  await page.reload()
  await expect(page.getByTestId('pairing-status')).toHaveText('1 role differs from the pairing: Heading.')
  expect(await sel('Heading')).toBe(secondary)
  expect(await sel('Display')).toBe(primary)
  const stored = (await readProjects(page))[0]!['typography']
  expect(stored.pairing.primary.kind).toBe('source')
  expect(stored.pairing.secondary.kind).toBe('source')
})

test('role suggestions and catalog ordering show their reasons, and ask for a brand direction first', async ({ page }) => {
  await createProject(page, 'Suggest', 'Brand Typography System')
  const body = page.getByRole('listitem', { name: 'Body' })
  await body.getByText('Font suggestions for body text').click()
  await expect(body).toContainText('Set a tone or a use case in the brand direction')
  await expect(page.getByRole('region', { name: 'Suggested pairings' })).toContainText('Set a tone or a use case')

  await tab(page, 'Overview').click()
  await brandDirection(page)
  await tab(page, 'Brand Typography System').click()
  await body.getByText('Font suggestions for body text').click()
  const suggestion = body.locator('[data-suggestion]').first()
  await expect(suggestion).toContainText('Tagged for')
  const family = (await suggestion.getAttribute('data-suggestion'))!
  await body.getByRole('button', { name: new RegExp(`^Use ${family} for Body$`) }).click()
  await expect(fontOf(page, 'Body')).toHaveValue(/^source:/)

  await tab(page, 'Font catalog').click()
  await page.getByRole('button', { name: /^Sort:/ }).click()
  await page.getByRole('menuitemradio', { name: 'Best match for my brand' }).click()
  await expect(page.getByRole('list', { name: 'Fonts' }).getByRole('listitem').first()).toContainText(/match \+\d+/)
  await page.getByRole('button', { name: /^Filter/ }).click()
  await page.getByRole('button', { name: 'Use my brand’s tone and use cases' }).click()
  await expect(page.getByRole('checkbox', { name: 'Technical' })).toBeChecked()
  const n = await page.getByRole('list', { name: 'Fonts' }).getByRole('listitem').count()
  expect(n).toBeLessThan(24)
  await page.getByRole('button', { name: 'Details of Inter' }).click()
  await expect(page.getByRole('region', { name: 'Fit for your brand' })).toContainText('+2 Tagged for a technical tone')
})

test('roles can be added and removed, with the core roles protected', async ({ page }) => {
  await createProject(page, 'Role set', 'Brand Typography System')
  await expect(page.getByRole('list', { name: 'Roles' }).getByRole('listitem')).toHaveCount(5)
  for (const role of ['Display', 'Heading', 'Body', 'UI']) await expect(page.getByRole('listitem', { name: role }).getByRole('button', { name: /Remove role/ })).toHaveCount(0)
  await page.getByLabel('Add a role', { exact: true }).fill('Label')
  await page.getByLabel('Kind of the new role').selectOption({ label: 'Caption or label' })
  await page.getByRole('button', { name: 'Add role' }).click()
  await expect(page.getByRole('listitem', { name: 'Label' })).toBeVisible()
  await page.getByRole('button', { name: 'Remove role Caption' }).click()
  await expect(page.getByRole('group', { name: 'Confirm removing Caption' })).toContainText('settings are lost')
  await page.getByRole('button', { name: 'Remove role', exact: true }).click()
  await expect(page.getByRole('listitem', { name: 'Caption' })).toHaveCount(0)
  await saved(page)
  await page.reload()
  await expect(page.getByRole('list', { name: 'Roles' }).getByRole('listitem')).toHaveCount(5)
  await expect(page.getByRole('listitem', { name: 'Label' })).toBeVisible()
  // A second body role makes the first removable.
  await page.getByLabel('Add a role', { exact: true }).fill('Body 2')
  await page.getByLabel('Kind of the new role').selectOption({ label: 'Body text' })
  await page.getByRole('button', { name: 'Add role' }).click()
  await expect(page.getByRole('listitem', { name: 'Body', exact: true }).getByRole('button', { name: /Remove role/ })).toBeVisible()
})

test('the type scale editor refuses impossible values, explains unlikely ones and keeps everything after a refresh', async ({ page }) => {
  await createProject(page, 'Scale', 'Brand Typography System')
  // Impossible values are refused with the range.
  await page.getByLabel('Ratio', { exact: true }).fill('9')
  await expect(page.getByText('Between 1 and 3')).toBeVisible()
  await page.getByLabel('Ratio', { exact: true }).blur()
  await expect(page.getByLabel('Ratio', { exact: true })).toHaveValue('1.25')
  // Unlikely values are allowed and explained.
  await expect(page.getByTestId('scale-checks')).toContainText('Nothing unusual')
  await page.getByLabel('Ratio', { exact: true }).fill('1.8')
  await expect(page.getByTestId('scale-checks')).toContainText('A ratio of 1.8 makes each step much larger than the last')
  await page.getByLabel('Base size (px)').fill('10')
  await expect(page.getByTestId('scale-checks')).toContainText('A base size of 10px is small for running text')
  await page.getByLabel('Base size (px)').fill('16')
  await page.getByLabel('Ratio', { exact: true }).fill('1.25')
  await expect(page.getByTestId('scale-checks')).toContainText('Nothing unusual')
  // A role value that is allowed but impractical is explained on the role itself.
  await page.getByLabel('Line height of Body').fill('1.1')
  await expect(page.getByRole('listitem', { name: 'Body' }).getByTestId('role-issues')).toContainText('running text usually needs 1.4 or more')
  await page.getByLabel('Line height of Body').fill('1.55')

  // Heading and body sizes.
  await page.getByLabel('Heading 1 step').fill('7')
  await page.getByLabel('Body large step').fill('2')
  await page.getByLabel('Body small step').fill('-2')
  await expect(page.getByText('Heading 1').first()).toBeVisible()
  await expect(page.getByTestId('scale-checks')).toContainText('Nothing unusual')
  await page.getByLabel('Heading 2 step').fill('8')
  await expect(page.getByTestId('scale-checks')).toContainText('Heading 2 is larger than Heading 1')
  await page.getByLabel('Heading 2 step').fill('4')

  // Fluid sizes.
  await page.getByText('Make sizes fluid').click()
  await page.getByLabel('Small screen width (px)').fill('900')
  await page.getByLabel('Large screen width (px)').fill('1000')
  await page.getByLabel('Small screen width (px)').fill('300')
  await page.getByLabel('Large screen width (px)').fill('600')
  await page.getByLabel('Small screen width (px)').fill('599')
  await page.getByLabel('Small screen width (px)').fill('600')
  await expect(page.getByRole('alert').filter({ hasText: 'narrower than the large screen width' })).toBeVisible()
  await page.getByLabel('Small screen width (px)').fill('360')
  await page.getByLabel('Large screen width (px)').fill('1440')
  await page.getByLabel('Small scale base (px)').fill('20')
  await expect(page.getByTestId('scale-checks')).toContainText('The small-screen base (20px) is larger than the main base (16px)')
  await page.getByLabel('Small scale base (px)').fill('14')
  await saved(page)

  await page.reload()
  await expect(page.getByLabel('Heading 1 step')).toHaveValue('7')
  await expect(page.getByLabel('Body large step')).toHaveValue('2')
  await expect(page.getByLabel('Body small step')).toHaveValue('-2')
  await expect(page.getByLabel('Small screen width (px)')).toHaveValue('360')
  await expect(page.getByLabel('Large screen width (px)')).toHaveValue('1440')
  await expect(page.getByLabel('Small scale base (px)')).toHaveValue('14')
  const t = (await readProjects(page))[0]!['typography']
  expect(t.sizes).toEqual({ headings: [7, 4, 3, 2, 1, 0], bodyLarge: 2, bodySmall: -2 })
  expect(t.responsive).toMatchObject({ enabled: true, minViewportPx: 360, maxViewportPx: 1440, minBaseSizePx: 14 })
})

test('the preview draws exactly what the exported CSS describes, at every width, and updates as controls change', async ({ page, browser }) => {
  await createProject(page, 'Parity')
  await brandDirection(page)
  await tab(page, 'Brand Typography System').click()
  await page.getByRole('region', { name: 'Suggested pairings' }).locator('[data-pairing]').first().getByRole('button', { name: /^Use and apply/ }).click()
  await page.getByText('Make sizes fluid').click()
  await page.getByLabel('Small scale base (px)').fill('13')
  await page.getByLabel('Weight of Body').fill('300')
  await page.getByLabel('Line height of Body').fill('1.7')
  await page.getByLabel('Tracking (em) of Body').fill('0.02')
  await page.getByLabel('Heading 1 step').fill('6')
  await saved(page)

  const preview = page.getByTestId('brand-preview')
  await preview.getByText('Editorial', { exact: true }).click()
  await page.getByRole('link', { name: 'Export', exact: true }).first().click()
  await expect(page.getByTestId('export-sync')).toContainText('revision')
  const css = (await download(page, 'Download CSS variables and font declarations')).text
  expect(css).toMatch(/--type-h1-size: clamp\(/)
  await page.goBack()
  await preview.getByText('Editorial', { exact: true }).click()

  // Another page applies the exported stylesheet, at the same viewport widths as the preview.
  const probe = await (await browser.newContext()).newPage()
  const cssFor = async (width: number, cls: string) => {
    await probe.setViewportSize({ width, height: 800 })
    await probe.setContent(`<style>${css}</style><p id="t" class="${cls}">Sample</p>`)
    return probe.locator('#t').evaluate((e) => { const c = getComputedStyle(e); return { size: parseFloat(c.fontSize), weight: c.fontWeight, lineHeight: parseFloat(c.lineHeight), spacing: parseFloat(c.letterSpacing), family: c.fontFamily } })
  }
  for (const [button, width] of [['Phone 390', 390], ['Tablet 768', 768]] as const) {
    await preview.getByText(button, { exact: true }).click()
    await expect(preview).toHaveAttribute('data-viewport', String(width))
    for (const [slot, cls] of [['title', 'type-h1'], ['p-0', 'type-body'], ['deck', 'type-body-lg'], ['note', 'type-body-sm'], ['h2', 'type-h2']] as const) {
      const el = preview.locator(`[data-slot="${slot}"]`)
      const shown = await el.evaluate((e) => { const c = getComputedStyle(e); return { size: parseFloat(c.fontSize), weight: c.fontWeight, lineHeight: parseFloat(c.lineHeight), spacing: parseFloat(c.letterSpacing), family: c.fontFamily } })
      const exported = await cssFor(width, cls)
      expect(shown.size, `${slot} size @${width}`).toBeCloseTo(exported.size, 1)
      expect(shown.weight, `${slot} weight`).toBe(exported.weight)
      expect(shown.lineHeight, `${slot} line height @${width}`).toBeCloseTo(exported.lineHeight, 1)
      expect(shown.spacing, `${slot} spacing`).toBeCloseTo(exported.spacing, 2)
      expect(shown.family, `${slot} family`).toBe(exported.family)
    }
  }
  // Fluid sizes really differ between the two widths.
  expect((await cssFor(390, 'type-h1')).size).toBeLessThan((await cssFor(768, 'type-h1')).size)
  await probe.context().close()

  // Changing a control changes the preview at once, with no reload.
  const before = await preview.locator('[data-slot="p-0"]').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
  await page.getByLabel('Scale step of Body').fill('1')
  await expect(async () => expect(await preview.locator('[data-slot="p-0"]').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThan(before)).toPass()
})

test('the preview environment: four contexts, light and dark surfaces, widths, and saved sample text', async ({ page }) => {
  await createProject(page, 'Env', 'Brand Typography System')
  const preview = page.getByTestId('brand-preview')
  const surface = preview.getByTestId('preview-surface')
  for (const [name, slot] of [['Website', 'headline'], ['Editorial', 'title'], ['Product interface', 'title'], ['Poster', 'headline']] as const) {
    await preview.getByText(name, { exact: true }).click()
    await expect(surface).toBeVisible()
    await expect(preview.locator(`[data-slot="${slot}"]`)).toBeVisible()
  }
  await preview.getByText('Website', { exact: true }).click()
  await expect(surface.getByRole('link')).toHaveCount(0)
  await expect(surface).toContainText('Get started') // a button
  await expect(surface).toContainText('Work') // navigation
  const bg = () => surface.evaluate((e) => getComputedStyle(e).backgroundColor)
  expect(await bg()).toBe('rgb(255, 255, 255)')
  await preview.getByText('Dark', { exact: true }).click()
  await expect(preview).toHaveAttribute('data-surface', 'dark')
  expect(await bg()).toBe('rgb(31, 31, 29)')
  expect(await preview.locator('[data-slot="headline"]').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(244, 244, 242)')

  await preview.getByText('Phone 390', { exact: true }).click()
  expect(Math.round((await surface.boundingBox())!.width)).toBe(390)
  await preview.getByText('Tablet 768', { exact: true }).click()
  expect(Math.round((await surface.boundingBox())!.width)).toBe(768)

  // Editable sample copy is saved with the project and shown again after a refresh.
  await page.getByText('Change the sample text').click()
  await page.getByLabel('Headline').fill('Plan the week in one view')
  await preview.getByText('Editorial', { exact: true }).click()
  await page.getByLabel(/Long-form text/).fill('First paragraph of my own.\n\nSecond paragraph of my own.')
  await expect(preview.locator('[data-slot="p-0"]')).toHaveText('First paragraph of my own.')
  await expect(preview.locator('[data-slot="p-1"]')).toHaveText('Second paragraph of my own.')
  await expect(preview.locator('[data-slot="title"]')).toHaveText('Plan the week in one view')
  await saved(page)
  await page.reload()
  await page.getByTestId('brand-preview').getByText('Editorial', { exact: true }).click()
  await expect(page.getByTestId('brand-preview').locator('[data-slot="title"]')).toHaveText('Plan the week in one view')
  // The specimen uses the same text.
  await page.getByRole('link', { name: 'Export', exact: true }).first().click()
  await expect(page.getByTestId('export-sync')).toContainText('revision')
  const specimen = await download(page, 'Download HTML specimen')
  expect(specimen.text).toContain('Plan the week in one view')
  expect(specimen.text).toContain('@media print')
})

test('fallback stacks are edited, validated, exported and saved', async ({ page }) => {
  await createProject(page, 'Stacks', 'Brand Typography System')
  await fontOf(page, 'Body').selectOption({ label: 'Inter' })
  const stack = page.locator('[data-font-source="Inter"]').getByLabel('Fallback families for Inter')
  await stack.fill('Helvetica Neue, "Arial" ,arial, Segoe UI')
  await stack.blur()
  await expect(page.locator('[data-font-source="Inter"]').getByTestId('stack-preview')).toContainText('"Inter", "Helvetica Neue", "Arial", "Segoe UI", sans-serif')
  await page.locator('[data-font-source="Inter"]').getByLabel('Generic family for Inter').selectOption('system-ui')
  await saved(page)
  await page.reload()
  await expect(page.locator('[data-font-source="Inter"]').getByLabel('Fallback families for Inter')).toHaveValue('Helvetica Neue, Arial, Segoe UI')
  await page.getByRole('link', { name: 'Export', exact: true }).first().click()
  await expect(page.getByTestId('export-sync')).toContainText('revision')
  const css = await download(page, 'Download CSS variables and font declarations')
  expect(css.text).toContain('--font-body: "Inter", "Helvetica Neue", "Arial", "Segoe UI", system-ui;')
  const tokens = JSON.parse((await download(page, 'Download Design tokens (JSON)')).text)
  expect(tokens.typography.body.$value.fontFamily).toEqual(['Inter', 'Helvetica Neue', 'Arial', 'Segoe UI', 'system-ui'])
})

test('a complete system is built end to end and every export carries the saved state', async ({ page }) => {
  await createProject(page, 'Complete')
  await brandDirection(page)
  await tab(page, 'Font catalog').click()
  await page.getByLabel('Add to project: Inter').click()
  await page.getByLabel('Add to project: Lora').click()
  await page.getByRole('button', { name: 'Details of Lora' }).click()
  await page.getByRole('button', { name: 'Use as primary font' }).click()
  await page.getByRole('button', { name: 'Close Lora' }).click()
  await page.getByRole('button', { name: 'Details of Inter' }).click()
  await page.getByRole('button', { name: 'Use as secondary font' }).click()
  await page.getByRole('button', { name: 'Close Inter' }).click()
  await tab(page, 'Brand Typography System').click()
  await page.getByRole('button', { name: 'Apply pairing to roles' }).click()
  await expect(page.getByTestId('pairing-status')).toHaveText('Every role follows the pairing.')
  await expect(page.getByTestId('brand-preview').locator('[data-slot="headline"]')).toHaveAttribute('data-font-origin', 'catalog')
  await saved(page)

  const flow = async () => {
    await tab(page, 'Overview').click()
    return page.getByRole('list', { name: 'Brand workflow' })
  }
  const steps = await flow()
  for (const id of ['brand', 'fonts', 'system', 'scale', 'preview']) await expect(steps.locator(`[data-step="${id}"]`)).toHaveAttribute('data-state', 'done')

  await page.getByRole('link', { name: 'Export', exact: true }).first().click()
  const sync = page.getByTestId('export-sync')
  await expect(sync).toContainText('revision')
  const revision = (await sync.getAttribute('data-revision'))!
  const css = (await download(page, 'Download CSS variables and font declarations')).text
  const spec = (await download(page, 'Download Typography specification')).text
  const tokens = JSON.parse((await download(page, 'Download Design tokens (JSON)')).text)
  const manifest = (await download(page, 'Download Sources and licences')).text
  const specimen = (await download(page, 'Download HTML specimen')).text
  const project = JSON.parse((await download(page, 'Download Project file (backup)')).text).project
  for (const text of [css, spec, manifest, specimen]) expect(text).toContain(revision)
  expect(tokens.$extensions['com.tynovo'].revision).toBe(revision)
  // They agree with each other and with the saved project.
  expect(css).toContain('--font-display: "Lora", serif;')
  expect(css).toContain('--font-body: "Inter", sans-serif;')
  expect(css).toMatch(/\.type-h1 \{[^}]*var\(--font-heading\)/)
  expect(tokens.heading.h1.$value.fontFamily).toEqual(['Lora', 'serif'])
  expect(tokens.body['body-lg'].$value.fontFamily).toEqual(['Inter', 'sans-serif'])
  expect(spec).toContain('| Heading | Heading | Lora | Existing font, bundled |')
  expect(spec).toContain('### Heading and body sizes')
  expect(project.typography.pairing.primary.kind).toBe('source')
  expect(manifest).toMatch(/Lora \| Display, Heading \| Existing font, bundled \| SIL Open Font License 1.1 \(OFL-1.1\) \| yes \| no: supply separately \|/)
  expect(manifest).toMatch(/distributed as @fontsource\/lora \(version \d+\.\d+\.\d+\), upstream version v\d+/)
  expect(manifest).toMatch(/Copyright: /)
  expect(css).toMatch(/from the @fontsource\/lora package \(version \d+\.\d+\.\d+\)/)
  expect(specimen).toMatch(/not included/)
  expect(css).not.toMatch(/^@font-face \{/m) // no third-party file is bundled or declared
})
