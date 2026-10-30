import { CATALOG_DATA } from '../src/modules/font-catalog/catalog.data'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createProject } from './helpers'

/** Size of the bundled catalog, read from the generated data so a test never hard-codes it. */
const N = CATALOG_DATA.length

/** The catalog's search and filters: one compact row, a Filter panel, a Sort menu, applied filters as chips. */
async function openCatalog(page: Page) {
  await createProject(page, 'Toolbar')
  await page.getByRole('navigation', { name: 'Project sections' }).getByRole('link', { name: 'Font catalog' }).click()
  await expect(page.getByTestId('catalog-count')).toHaveText(`${N} of ${N} fonts.`)
}
const filterButton = (page: Page) => page.getByRole('button', { name: /^Filter/ })
const panel = (page: Page) => page.getByRole('dialog', { name: 'Filter fonts' })
const sortButton = (page: Page) => page.getByRole('button', { name: /^Sort:/ })

test.describe('compact toolbar', () => {
  test('search, filter and sort fit one row of controls, and the fonts start much higher on the page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openCatalog(page)
    const bar = (await page.getByRole('region', { name: 'Search and filters' }).boundingBox())!
    expect(bar.height, 'one row, not a card of chip rows').toBeLessThan(60)
    const first = (await page.getByRole('list', { name: 'Fonts' }).getByRole('listitem').first().boundingBox())!
    expect(first.y + first.height, 'the first font is on the first screen, not pushed below a filter card').toBeLessThan(900)
    expect(first.y - (bar.y + bar.height), 'and sits right under the toolbar').toBeLessThan(40)
    // The three controls share a line.
    const [s, f, o] = [await page.getByLabel('Search by family name').boundingBox(), await filterButton(page).boundingBox(), await sortButton(page).boundingBox()]
    expect(Math.abs(s!.y - f!.y)).toBeLessThan(6)
    expect(Math.abs(f!.y - o!.y)).toBeLessThan(6)
    await expect(panel(page)).toHaveCount(0) // the chips are not on the page until asked for
  })

  test('on a phone the search takes its own full-width line and nothing overflows', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openCatalog(page)
    const search = (await page.getByLabel('Search by family name').boundingBox())!
    expect(search.width).toBeGreaterThan(390 - 60)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    await filterButton(page).click()
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running')) // let it finish arriving
    const p = (await panel(page).boundingBox())!
    expect(p.x, 'a bottom sheet inside the screen on a phone').toBeGreaterThanOrEqual(0)
    expect(p.x + p.width).toBeLessThanOrEqual(390)
    expect(p.y).toBeGreaterThanOrEqual(0)
    expect(p.y + p.height).toBeLessThanOrEqual(844)
    expect(Math.round(p.y + p.height)).toBe(844 - 8) // resting on the bottom edge
  })
})

test.describe('the filter panel', () => {
  test('opens from the Filter button, groups the chips, counts what is applied, and closes on Escape with focus back on the button', async ({ page }) => {
    await openCatalog(page)
    await expect(filterButton(page)).toHaveAttribute('aria-expanded', 'false')
    await filterButton(page).click()
    await expect(filterButton(page)).toHaveAttribute('aria-expanded', 'true')
    for (const group of ['Category', 'Tone (studio tags)', 'Use (studio tags)']) await expect(panel(page).getByRole('group', { name: group })).toBeVisible()
    await panel(page).getByRole('checkbox', { name: 'Serif', exact: true }).check({ force: true })
    await panel(page).getByRole('checkbox', { name: 'Elegant' }).check({ force: true })
    await expect(filterButton(page)).toContainText('2')
    await expect(filterButton(page).getByLabel('2 applied')).toBeVisible()
    await expect(page.getByTestId('catalog-count')).toContainText('match')
    await page.keyboard.press('Escape')
    await expect(panel(page)).toHaveCount(0)
    await expect(filterButton(page)).toBeFocused()
    await expect(filterButton(page)).toHaveAttribute('aria-expanded', 'false')
  })

  test('a click outside closes it, and the panel header clears what is applied but keeps the search', async ({ page }) => {
    await openCatalog(page)
    await page.getByLabel('Search by family name').fill('e')
    await filterButton(page).click()
    await panel(page).getByText('Monospace', { exact: true }).click()
    await panel(page).getByRole('button', { name: 'Clear 1' }).click()
    await expect(filterButton(page).getByLabel('1 applied')).toHaveCount(0)
    await expect(page.getByLabel('Search by family name')).toHaveValue('e')
    await page.getByRole('heading', { name: 'Font catalog' }).click()
    await expect(panel(page)).toHaveCount(0)
  })

  test('closing it does not move the page: it never changes the page height, so nothing jumps', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 720 })
    await openCatalog(page)
    await page.getByLabel('Search by family name').fill('zzzz') // a short page: the case where a tall panel used to stretch it
    const measure = () => page.evaluate(() => ({ docH: document.documentElement.scrollHeight, y: window.scrollY }))
    const before = await measure()
    await filterButton(page).click()
    await expect(panel(page)).toBeVisible()
    expect((await measure()).docH, 'opening does not make the page taller').toBe(before.docH)
    const clear = page.getByRole('button', { name: 'Clear filters' }).first()
    const at = (await clear.boundingBox())!
    await page.keyboard.press('Escape')
    expect(await measure()).toEqual(before)
    expect(await clear.boundingBox()).toEqual(at) // and the controls stayed where they were
  })

  test('the panel follows the toolbar when the page scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 500 })
    await openCatalog(page)
    await filterButton(page).click()
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
    // The panel opens below the toolbar or, when there is more room above, above it; either way it hugs the button's edge.
    const edge = async () => {
      const [p, b] = [(await panel(page).boundingBox())!, (await filterButton(page).boundingBox())!]
      return Math.round(Math.min(Math.abs(p.y - (b.y + b.height)), Math.abs(b.y - (p.y + p.height))))
    }
    expect(await edge()).toBeLessThanOrEqual(8)
    await page.mouse.wheel(0, 120)
    await expect.poll(edge).toBeLessThanOrEqual(8) // still attached after the page moved under it
  })
})

test.describe('applied filters and sorting', () => {
  test('applied filters stay visible as chips that can be removed one by one or all at once', async ({ page }) => {
    await openCatalog(page)
    await page.getByLabel('Search by family name').fill('serif')
    await filterButton(page).click()
    await panel(page).getByText('Serif', { exact: true }).click()
    await panel(page).getByText('Elegant', { exact: true }).click()
    await page.keyboard.press('Escape')
    const chips = page.getByRole('list', { name: 'Applied filters' })
    await expect(chips).toContainText('“serif”')
    await expect(chips).toContainText('Serif')
    await expect(chips).toContainText('Elegant')
    await chips.getByRole('button', { name: 'Remove Elegant filter' }).click()
    await expect(chips).not.toContainText('Elegant')
    await expect(filterButton(page).getByLabel('1 applied')).toBeVisible()
    await chips.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByTestId('catalog-count')).toHaveText(`${N} of ${N} fonts.`)
    await expect(page.getByLabel('Search by family name')).toHaveValue('')
    await expect(chips).toHaveCount(0)
  })

  test('sort is a menu of two choices showing the current one, and asks for a brand direction before ordering by match', async ({ page }) => {
    await openCatalog(page)
    await expect(sortButton(page)).toHaveAccessibleName('Sort: A to Z')
    await expect(sortButton(page)).toContainText('A to Z')
    await sortButton(page).click()
    await expect(page.getByRole('menuitemradio')).toHaveText(['A to Z', 'Best match for my brand'])
    await expect(page.getByRole('menuitemradio', { name: 'A to Z' })).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('menuitemradio', { name: 'Best match for my brand' }).click()
    await expect(sortButton(page)).toHaveAccessibleName('Sort: Best match for my brand')
    await expect(page.getByText('Ordering by match needs a tone or a use case.')).toBeVisible()
    await expect(sortButton(page)).toBeFocused() // focus is not lost when the menu closes
  })
})

test.describe('accessibility', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const width of [1440, 390]) {
      test(`with the panel open, ${scheme} theme, ${width}px: no violations at WCAG 2.2 AA`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme })
        await page.setViewportSize({ width, height: 900 })
        await openCatalog(page)
        await page.getByLabel('Search by family name').fill('s')
        await filterButton(page).click()
        await panel(page).getByText('Serif', { exact: true }).click()
        await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity))
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
      })
    }
  }
})
