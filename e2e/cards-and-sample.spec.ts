import { CATALOG_DATA } from '../src/modules/font-catalog/catalog.data'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { cardAction, createProject, readProjects, saved, writeProjects } from './helpers'

/** Size of the bundled catalog, read from the generated data so a test never hard-codes it. */
const N = CATALOG_DATA.length

const SAMPLE = '/app/projects/sample-fieldnote'
const card = (page: Page, name: string) => page.locator(`li[data-project="${name}"]`)
/** The screens are reached through the workflow bar, whose steps carry short names. */
const SCREEN_LINK: Record<string, string> = { Overview: 'Brand', 'Font catalog': 'Fonts', 'Brand Typography System': 'Roles', 'Custom Typeface Creator': 'Typeface' }
const tab = (page: Page, name: string) => page.getByRole('link', { name: SCREEN_LINK[name] ?? name, exact: true }).first()

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
    await expect(page.getByRole('dialog', { name: 'Delete “Menu done (copy)”?' })).toBeVisible()
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
    await expect(page.getByTestId('catalog-count')).toHaveText(`${N} of ${N} fonts.`)
    await page.getByLabel('Search by family name').fill('plex')
    await expect(page.getByTestId('catalog-count')).toHaveText(`3 of ${N} fonts match.`)
    await expect(page.getByRole('button', { name: 'Add to project: IBM Plex Sans' })).toBeDisabled()
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

test.describe('Doxa-matched app styling', () => {
  const css = (l: ReturnType<Page['locator']>, ...props: string[]) => l.evaluate((e, ps) => Object.fromEntries(ps.map((p) => [p, getComputedStyle(e).getPropertyValue(p)])), props)

  test('the sample is a wide banner on top, with its key facts, above the projects you made', async ({ page }) => {
    await createProject(page, 'Mine')
    await page.goto('/app/projects')
    const sample = page.locator('li[data-sample="true"]')
    const mine = page.locator('li[data-project="Mine"]')
    await expect(sample).toBeVisible()
    await expect(mine).toBeVisible()
    const [s, m, own] = [await sample.boundingBox(), await mine.boundingBox(), await page.getByRole('heading', { name: /^Your projects/ }).boundingBox()]
    expect(s!.y + s!.height, 'the sample ends before "Your projects" starts').toBeLessThan(own!.y)
    expect(own!.y).toBeLessThan(m!.y)
    expect(s!.width, 'a banner spans the content, not one grid column').toBeGreaterThan(m!.width * 2)
    // Key information and metadata are on the banner itself.
    await expect(sample).toContainText('Brand: Fieldnote')
    for (const term of ['Fonts', 'Roles with a font', 'Own typeface', 'Exports']) await expect(sample.locator('dl')).toContainText(term)
    await expect(sample.getByRole('list', { name: 'Tone and use' })).toBeVisible()
    await expect(sample.getByRole('button')).toHaveCount(1) // the menu is the only button; the whole banner opens the sample
    // The buttons for your own projects belong to that list, not to the page title.
    await expect(page.getByRole('heading', { name: /^Your projects/ }).locator('xpath=ancestor::div[1]').getByRole('button', { name: 'New project' })).toBeVisible()
  })

  test('cards: 16px radius, white, hairline and soft shadow by default; primary border, raised shadow and a 2px lift on hover', async ({ page }) => {
    await createProject(page, 'Hover me')
    await page.goto('/app/projects')
    const card = page.locator('li[data-project="Hover me"]')
    const base = await css(card, 'border-top-left-radius', 'background-color', 'border-top-color', 'box-shadow')
    expect(base['border-top-left-radius']).toBe('16px')
    expect(base['background-color']).toBe('rgb(255, 255, 255)')
    expect(base['border-top-color']).toBe('rgb(232, 221, 200)') // #e8ddc8
    expect(base['box-shadow']).not.toBe('none')
    await card.hover()
    await expect.poll(async () => (await css(card, 'border-top-color'))['border-top-color']).toBe('rgb(199, 69, 4)') // #c74504
    const lifted = await css(card, 'box-shadow', 'transform')
    expect(lifted['box-shadow']).not.toBe(base['box-shadow'])
    await expect.poll(async () => (await css(card, 'translate'))['translate']).toBe('0px -2px') // Tailwind v4 lifts with the `translate` property
  })

  test('the shell: cream sidebar with a 56px logo header and a hairline, white panel with a sticky 56px top bar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 })
    await createProject(page, 'Shell')
    await page.goto('/app/projects')
    const side = page.getByRole('complementary')
    expect(await side.evaluate((e) => ({ w: e.getBoundingClientRect().width, bg: getComputedStyle(e).backgroundColor, bd: getComputedStyle(e).borderRightColor }))).toEqual({ w: 240, bg: 'rgb(244, 242, 234)', bd: 'rgb(232, 221, 200)' })
    const bar = page.getByRole('banner')
    expect(Math.round((await bar.boundingBox())!.height)).toBe(56) // 56px, hairline included (border-box)
    await page.evaluate(() => window.scrollTo(0, 400))
    expect(Math.round((await bar.boundingBox())!.y)).toBe(0) // stays put while the page scrolls
    expect(await side.evaluate((e) => e.getBoundingClientRect().top)).toBe(0) // so does the sidebar
  })

  test('a drawer opens above the sticky top bar, not under it', async ({ page }) => {
    await page.goto('/app/projects')
    await page.getByRole('button', { name: /New project|Create your first project/ }).first().click()
    const close = page.getByRole('button', { name: 'Close New project' })
    await expect(close).toBeVisible()
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)))) // it slides in from the right: measure where it has settled
    const b = (await close.boundingBox())!
    const topmost = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label'), { x: b.x + b.width / 2, y: b.y + b.height / 2 })
    expect(topmost).toBe('Close New project')
  })
})

test.describe('layout: four cards, aligned workflow', () => {
  test('project cards run 1, 2, 3 then 4 across as the content area widens, never more than 4', async ({ page }) => {
    await createProject(page, 'P0')
    const [row] = await readProjects(page)
    const now = Date.now()
    await writeProjects(page, Array.from({ length: 9 }, (_, i) => ({ ...row!, id: `clone-${i}`, name: `P${i + 1}`, updatedAt: new Date(now + (i + 1) * 1000).toISOString() })))
    for (const [width, columns] of [[390, 1], [800, 2], [1100, 3], [1440, 4], [1920, 4], [2560, 4]] as const) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/app/projects')
      await expect(page.locator('li[data-project^="P"]')).toHaveCount(10)
      const xs = await page.locator('ul[aria-label="Projects"] > li').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)))
      expect(new Set(xs).size, `columns @${width}`).toBe(columns)
      const w = await page.locator('ul[aria-label="Projects"] > li').first().evaluate((e) => e.getBoundingClientRect().width)
      expect(w, `card width @${width}`).toBeGreaterThan(228) // room for the facts without cutting them
    }
  })

  for (const [label, open] of [
    ['the sample project', async (page: Page) => page.goto('/app/projects/sample-fieldnote')],
    ['a project of your own', async (page: Page) => createProject(page, 'Aligned')],
  ] as const) {
    test(`the workflow list on the overview of ${label} lines up: one column for status, one for description, one centre line`, async ({ page }) => {
      for (const width of [1440, 1920]) {
        await page.setViewportSize({ width, height: 900 })
        await open(page)
        const rows = page.locator('li[data-step]')
        await expect(rows).toHaveCount(8)
        const m = await rows.evaluateAll((els) =>
          els.map((li) => {
            const r = (sel: string) => li.querySelector(sel)!.getBoundingClientRect()
            const [status, detail] = [r('[data-part="status"]'), r('[data-part="detail"]')]
            return { x: [Math.round(status.left), Math.round(detail.left)], dy: Math.abs(status.top + status.height / 2 - (detail.top + detail.height / 2)) }
          }),
        )
        expect(new Set(m.map((r) => r.x[0])).size, `status column @${width}`).toBe(1)
        expect(new Set(m.map((r) => r.x[1])).size, `description column @${width}`).toBe(1)
        for (const r of m) expect(r.dy, `centre line @${width}`).toBeLessThanOrEqual(2)
      }
    })
  }
})

test.describe('deleting a project asks in a modal', () => {
  const openDelete = async (page: Page, name: string) => {
    await cardAction(page, name, /^Delete/)
    const dialog = page.getByRole('dialog', { name: `Delete “${name}”?` })
    await expect(dialog).toBeVisible()
    return dialog
  }

  test('it is a real modal: named, described, focus on the safe choice, the page behind unreachable', async ({ page }) => {
    await createProject(page, 'Doomed')
    await page.goto('/app/projects')
    const dialog = await openDelete(page, 'Doomed')
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    await expect(dialog).toContainText('cannot be brought back')
    await expect(dialog.getByRole('button', { name: 'Keep' })).toBeFocused() // Enter cannot delete by accident
    expect(await page.getByRole('button', { name: 'More actions for Doomed' }).evaluate((e) => !!e.closest('[inert]'))).toBe(true)
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => !!document.activeElement?.closest('[data-modal]') || document.activeElement === document.body), `Tab ${i + 1} stays in the dialog`).toBe(true)
    }
    await expect(page.getByRole('dialog')).toHaveCount(1)
  })

  test('Escape, the backdrop and Keep all cancel, leave the project, and give focus back to its menu', async ({ page }) => {
    await createProject(page, 'Survivor')
    await page.goto('/app/projects')
    const menu = page.getByRole('button', { name: 'More actions for Survivor' })
    for (const cancel of [() => page.keyboard.press('Escape'), () => page.mouse.click(8, 8), () => page.getByRole('button', { name: 'Keep' }).click()]) {
      await openDelete(page, 'Survivor')
      await cancel()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(card(page, 'Survivor')).toBeVisible()
      await expect(menu).toBeFocused()
    }
    expect((await readProjects(page)).map((r) => r['name'])).toEqual(['Survivor'])
  })

  test('confirming deletes it, says so, and puts focus on the list heading because the card is gone', async ({ page }) => {
    await createProject(page, 'Gone soon')
    await page.goto('/app/projects')
    const dialog = await openDelete(page, 'Gone soon')
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(card(page, 'Gone soon')).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: 'Deleted “Gone soon”.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Your projects/ })).toBeFocused()
    expect(await readProjects(page)).toEqual([])
  })

  test('the project settings page asks the same way, and Keep it returns to the button', async ({ page }) => {
    await createProject(page, 'From settings')
    await page.getByRole('main').getByRole('link', { name: 'Settings', exact: true }).click() // the project's own, not the app's
    const trigger = page.getByRole('button', { name: 'Delete this project…' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Delete “From settings”?' })
    await expect(dialog.getByRole('button', { name: 'Keep it' })).toBeFocused()
    await dialog.getByRole('button', { name: 'Keep it' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await trigger.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete project' }).click()
    await expect(page).toHaveURL(/\/app\/projects$/)
  })
})

test.describe('the sample project can be collapsed, and stays that way', () => {
  const toggle = (page: Page) => page.getByRole('button', { name: /^(Hide|Show) sample project$/ })
  const sampleCard = (page: Page) => page.locator('li[data-sample="true"]')
  const stored = (page: Page) => page.evaluate(() => localStorage.getItem('tynovo.sampleCollapsed'))

  test('it starts open, collapses on request, and is still collapsed after navigating away, back and reloading', async ({ page }) => {
    await page.goto('/app/projects')
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(sampleCard(page)).toBeVisible()
    expect(await stored(page)).toBeNull() // nothing is written until the person chooses

    await toggle(page).click()
    await expect(toggle(page)).toHaveAccessibleName('Show sample project')
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(sampleCard(page)).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Sample project' })).toBeVisible() // the header stays, so it can be reopened
    expect(await stored(page)).toBe('1')

    await page.getByRole('link', { name: 'Settings', exact: true }).first().click() // in-app navigation
    await page.getByRole('link', { name: 'Projects', exact: true }).first().click()
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(sampleCard(page)).toBeHidden()

    await page.reload()
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(sampleCard(page)).toBeHidden()

    await toggle(page).click()
    await expect(sampleCard(page)).toBeVisible()
    expect(await stored(page)).toBe('0')
    await page.reload()
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(sampleCard(page)).toBeVisible()
  })

  test('collapsing does not touch your projects, and the control is keyboard operable and wired to what it hides', async ({ page }) => {
    await createProject(page, 'Stays put')
    await page.goto('/app/projects')
    await toggle(page).focus()
    await page.keyboard.press('Enter')
    await expect(sampleCard(page)).toBeHidden()
    await expect(card(page, 'Stays put')).toBeVisible()
    expect(await toggle(page).getAttribute('aria-controls')).toBe('sample-body')
    await expect(page.locator('#sample-body')).toBeHidden()
    await page.keyboard.press('Space')
    await expect(sampleCard(page)).toBeVisible()
  })

  test('if the browser blocks storage the choice still holds while you move around, and nothing breaks', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError') }, configurable: true })
    })
    await page.goto('/app/projects')
    await toggle(page).click()
    await expect(sampleCard(page)).toBeHidden()
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await page.getByRole('link', { name: 'Projects', exact: true }).first().click()
    await expect(sampleCard(page)).toBeHidden() // remembered for the visit, from memory
  })
})
