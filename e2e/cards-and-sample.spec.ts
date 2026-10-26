import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { cardAction, createProject, readProjects, saved } from './helpers'

const SAMPLE = '/app/projects/sample-fieldnote'
const card = (page: Page, name: string) => page.locator(`li[data-project="${name}"]`)
const tab = (page: Page, name: string) => page.getByRole('link', { name, exact: true }).first()

test.describe('projects as cards', () => {
  test('each project is a card with its key facts, and every action sits under one menu', async ({ page }) => {
    await createProject(page, 'Card one')
    await page.getByLabel('Description').fill('A small coffee brand.')
    await page.getByText('Friendly', { exact: true }).click()
    await page.getByText('Consumer products', { exact: true }).click()
    await saved(page)
    await page.goto('/app/projects')
    const c = card(page, 'Card one')
    await expect(c).toBeVisible()
    await expect(c.getByRole('heading', { level: 3 })).toHaveText('Card one')
    await expect(c).toContainText('A small coffee brand.')
    await expect(c.getByRole('list', { name: 'Tone and use' })).toContainText('Friendly')
    await expect(c.getByRole('list', { name: 'Tone and use' })).toContainText('Consumer products')
    await expect(c.locator('dl')).toContainText('Roles with a font')
    await expect(c.locator('dl')).toContainText('0 of 5')
    await expect(c).toContainText('Edited ')
    await expect(c).toContainText('Created ')
    // Nothing on the card is an action button except the menu.
    await expect(c.getByRole('button')).toHaveCount(1)
    await expect(c.getByRole('button')).toHaveAccessibleName('More actions for Card one')
    await expect(page.getByRole('button', { name: /^(Rename|Duplicate|Delete) /i })).toHaveCount(0)
  })

  test('cards sit in a responsive grid and the whole card opens the project', async ({ page }) => {
    for (const name of ['Grid A', 'Grid B', 'Grid C']) await createProject(page, name)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/app/projects')
    const cards = page.getByRole('list', { name: 'Projects' }).locator('> li')
    await expect(cards).toHaveCount(3)
    for (const i of [0, 1, 2]) await expect(cards.nth(i)).toBeVisible()
    const boxes = await Promise.all([0, 1, 2].map((i) => cards.nth(i).boundingBox()))
    expect(new Set(boxes.map((b) => Math.round(b!.y))).size).toBe(1) // three across on a wide screen
    await page.setViewportSize({ width: 390, height: 800 })
    await page.reload()
    await expect(cards).toHaveCount(3)
    for (const i of [0, 1]) await expect(cards.nth(i)).toBeVisible()
    const narrow = await Promise.all([0, 1].map((i) => cards.nth(i).boundingBox()))
    expect(narrow[1]!.y).toBeGreaterThan(narrow[0]!.y + narrow[0]!.height - 2) // one column on a phone
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    await cards.nth(0).click({ position: { x: 40, y: 120 } }) // anywhere on the card, not only the title
    await expect(page).toHaveURL(/\/app\/projects\/[^/]+$/)
  })

  test('the menu works with a keyboard and closes when it should', async ({ page }) => {
    await createProject(page, 'Keys')
    await page.goto('/app/projects')
    const trigger = page.getByRole('button', { name: 'More actions for Keys' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu', { name: 'More actions for Keys' })
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem')).toHaveCount(5)
    await expect(menu.getByRole('menuitem', { name: 'Open' })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem', { name: 'Rename' })).toBeFocused()
    await page.keyboard.press('End')
    await expect(menu.getByRole('menuitem', { name: 'Delete…' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await trigger.click()
    await expect(menu).toBeVisible()
    await page.getByRole('heading', { name: 'Projects', level: 1 }).click() // elsewhere
    await expect(menu).toHaveCount(0)
    // Two menus never stay open together.
    await createProject(page, 'Keys two')
    await page.goto('/app/projects')
    await page.getByRole('button', { name: 'More actions for Keys', exact: true }).click()
    await page.getByRole('button', { name: 'More actions for Keys two' }).click()
    await expect(page.getByRole('menu')).toHaveCount(1)
  })

  test('rename, duplicate, export and delete all work from the menu', async ({ page }) => {
    await createProject(page, 'Menu work')
    await page.goto('/app/projects')
    await cardAction(page, 'Menu work', 'Rename')
    await page.getByLabel('New name for Menu work').fill('Menu done')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(card(page, 'Menu done')).toBeVisible()
    await cardAction(page, 'Menu done', 'Duplicate')
    await expect(card(page, 'Menu done (copy)')).toBeVisible()
    const [dl] = await Promise.all([page.waitForEvent('download'), cardAction(page, 'Menu done', 'Export project file')])
    expect(dl.suggestedFilename()).toBe('menu-done.tynovo.json')
    await cardAction(page, 'Menu done (copy)', /^Delete/)
    await expect(card(page, 'Menu done (copy)').getByRole('group', { name: /Confirm deleting/ })).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(card(page, 'Menu done (copy)')).toHaveCount(0)
    await expect(card(page, 'Menu done')).toBeVisible()
  })
})

test.describe('the sample project', () => {
  test('is offered on the projects page, even with no projects of your own', async ({ page }) => {
    await page.goto('/app/projects')
    const section = page.getByRole('region', { name: 'Sample project' })
    await expect(section).toBeVisible()
    const c = section.locator('li[data-sample="true"]')
    await expect(c).toHaveCount(1)
    await expect(c.getByTestId('sample-badge')).toHaveText('Sample, read-only')
    await expect(c).toContainText('Brand: Fieldnote')
    await expect(c).toContainText('Custom typeface')
    await expect(c.locator('dl')).toContainText('5 of 5')
    await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible() // the sample is not one of yours
    await page.getByRole('button', { name: 'More actions for Fieldnote sample' }).click()
    const items = page.getByRole('menu').getByRole('menuitem')
    await expect(items).toHaveText(['Open Fieldnote sample', 'Duplicate as my own project', 'Export project file'])
    expect(await readProjects(page)).toEqual([]) // and nothing is stored for it
  })

  test('can be read everywhere but changed nowhere', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/app/projects')
    await page.getByRole('link', { name: 'Fieldnote sample' }).click()
    await expect(page).toHaveURL(SAMPLE)
    await expect(page.getByTestId('read-only-badge')).toHaveText('Read-only sample')
    await expect(page.getByText('This is a read-only sample.')).toBeVisible()
    await expect(page.getByRole('main').getByRole('textbox', { name: 'Project name', exact: true })).toHaveAttribute('readonly', '')
    await expect(page.getByRole('button', { name: 'Save now' })).toHaveCount(0)

    // Overview: the finished workflow and the brand direction, all read-only.
    const flow = page.getByRole('list', { name: 'Brand workflow' })
    for (const id of ['brand', 'fonts', 'system', 'scale', 'typeface', 'preview']) await expect(flow.locator(`[data-step="${id}"]`)).toHaveAttribute('data-state', 'done')
    await expect(page.getByLabel('Brand name')).toHaveValue('Fieldnote')
    await expect(page.getByLabel('Brand name')).toBeDisabled()
    await expect(page.getByLabel('Description')).toBeDisabled()
    await expect(page.getByRole('checkbox', { name: 'Friendly' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Friendly' })).toBeDisabled()
    await expect(page.getByRole('slider', { name: 'Readability priority' })).toBeDisabled()

    // Font catalog: browse and filter freely, add nothing.
    await tab(page, 'Font catalog').click()
    await expect(page.getByTestId('catalog-count')).toHaveText('24 of 24 fonts.')
    await page.getByLabel('Search by family name').fill('plex')
    await expect(page.getByTestId('catalog-count')).toHaveText('3 of 24 fonts match.')
    await expect(page.getByRole('button', { name: 'Add IBM Plex Sans to project' })).toBeDisabled()
    await page.getByRole('button', { name: 'Details of IBM Plex Sans' }).click()
    await expect(page.getByRole('button', { name: 'Use as primary font' })).toBeDisabled()
    await page.getByRole('button', { name: 'Close IBM Plex Sans' }).click()

    // Typography: everything that edits is off; the previews are live and use the sample's fonts.
    await tab(page, 'Brand Typography System').click()
    await expect(page.getByLabel('Font of Display', { exact: true })).toHaveValue('custom')
    await expect(page.getByLabel('Font of Display', { exact: true })).toBeDisabled()
    await expect(page.getByLabel('Weight of Body')).toBeDisabled()
    await expect(page.getByLabel('Ratio', { exact: true })).toBeDisabled()
    await expect(page.getByText('Make sizes fluid')).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Make sizes fluid' })).toBeChecked()
    await expect(page.getByRole('button', { name: 'Apply pairing to roles' })).toBeDisabled()
    await expect(page.getByTestId('pairing-status')).toHaveText('1 role differs from the pairing: Display.')
    const preview = page.getByTestId('brand-preview')
    await expect(page.getByTestId('custom-font-status')).toHaveAttribute('data-state', 'ready')
    await expect(preview.locator('[data-slot="headline"]')).toHaveText('Slow-roasted, plainly written.')
    await expect(preview.locator('[data-slot="headline"]')).toHaveAttribute('data-font-origin', 'custom')
    await preview.getByText('Dark', { exact: true }).click() // viewing controls still work
    await expect(preview).toHaveAttribute('data-surface', 'dark')
    await preview.getByText('Phone 390', { exact: true }).click()
    await expect(preview).toHaveAttribute('data-viewport', '390')
    await page.getByText('Change the sample text').click()
    await expect(page.getByLabel('Headline')).toBeDisabled()

    // Typeface: look, do not touch.
    await tab(page, 'Custom Typeface Creator').click()
    await expect(page.getByLabel('Typeface name')).toHaveValue('Fieldnote Rounded')
    await expect(page.getByLabel('Typeface name')).toHaveAttribute('readonly', '')
    await expect(page.getByRole('slider', { name: 'Stroke thickness' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Remove typeface from project…' })).toBeDisabled()
    await page.getByRole('button', { name: 'Variants', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Saved variants' })).toContainText('Softer corners')
    for (const b of await page.getByRole('button', { name: 'Save', exact: true }).all()) await expect(b).toBeDisabled()
    for (const b of await page.getByRole('button', { name: 'Apply', exact: true }).all()) await expect(b).toBeDisabled()
    await page.getByRole('button', { name: 'Glyphs', exact: true }).click()
    await page.getByRole('button', { name: /^H, supported/ }).click()
    await expect(page.getByRole('img', { name: 'Outline of H' })).toBeVisible()
    await expect(page.getByRole('application', { name: 'Outline of H' })).toHaveCount(0) // no editing canvas
    await expect(page.getByText('Editing is switched off because this project is a read-only sample.')).toBeVisible()

    // Export: the sample can be exported like any project, and recording it is skipped.
    await tab(page, 'Export').click()
    await expect(page.getByTestId('export-sync')).toContainText('revision')
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download Typography specification', exact: true }).click()])
    const spec = readFileSync(await dl.path(), 'utf8')
    expect(spec.split('\n')[0]).toBe('# Fieldnote: typography specification')
    expect(spec).toContain('Fieldnote Rounded')
    await expect(page.getByRole('status').filter({ hasText: 'Downloaded typography-spec.md.' })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'recorded in the history' })).toHaveCount(0)

    // Settings: nothing to delete, a clear way to get your own copy.
    await page.getByRole('link', { name: 'Settings', exact: true }).last().click()
    await expect(page.getByText('there is nothing to delete')).toBeVisible()
    await expect(page.getByRole('button', { name: /Delete this project/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Duplicate as my own project' }).last()).toBeVisible()

    // Through all of that nothing was stored, and it is still the original after a reload.
    expect(await readProjects(page)).toEqual([])
    await page.goto(SAMPLE)
    await expect(page.getByLabel('Brand name')).toHaveValue('Fieldnote')
  })

  test('duplicating gives a copy you own, and leaves the sample exactly as it was', async ({ page }) => {
    await page.goto(SAMPLE)
    await page.getByRole('button', { name: 'Duplicate as my own project' }).first().click()
    await expect(page).not.toHaveURL(SAMPLE)
    await expect(page).toHaveURL(/\/app\/projects\/[^/]+$/)
    const name = page.getByRole('main').getByRole('textbox', { name: 'Project name', exact: true })
    await expect(name).toHaveValue('Fieldnote sample (copy)')
    await expect(page.getByTestId('read-only-badge')).toHaveCount(0)
    await expect(page.getByLabel('Brand name')).toBeEnabled()
    await page.getByLabel('Brand name').fill('My roastery')
    await saved(page)
    const rows = await readProjects(page)
    expect(rows).toHaveLength(1)
    expect(rows[0]!['brand'].name).toBe('My roastery')
    expect(rows[0]!['customTypeface'].familyName).toBe('Fieldnote Rounded') // the typeface came along
    expect(rows[0]!['typography'].roles.every((r: { font: unknown }) => r.font !== null)).toBe(true)
    await page.goto(SAMPLE)
    await expect(page.getByLabel('Brand name')).toHaveValue('Fieldnote')
    // The copy's edits to typography do not reach the sample either.
    await page.goto('/app/projects')
    await expect(card(page, 'Fieldnote sample (copy)')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Sample project' }).locator('li[data-sample="true"]')).toContainText('Brand: Fieldnote')
  })

  test('duplicating from the projects page puts the copy in your list', async ({ page }) => {
    await page.goto('/app/projects')
    await cardAction(page, 'Fieldnote sample', 'Duplicate as my own project')
    await expect(page.getByRole('alert').or(page.getByRole('status')).filter({ hasText: 'Duplicated as “Fieldnote sample (copy)”' })).toBeVisible()
    await expect(card(page, 'Fieldnote sample (copy)')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No projects yet' })).toHaveCount(0)
    await expect(card(page, 'Fieldnote sample (copy)').getByRole('button', { name: 'More actions for Fieldnote sample (copy)' })).toBeVisible()
  })

  test('is not part of the delete, rename or recovery paths, and a reload keeps it', async ({ page }) => {
    await page.goto('/app/projects')
    await page.getByRole('button', { name: 'More actions for Fieldnote sample' }).click()
    await expect(page.getByRole('menuitem', { name: /Rename|Delete/ })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.reload()
    await expect(page.locator('li[data-sample="true"]')).toHaveCount(1)
  })
})
