import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createProject } from './helpers'

const SAMPLE = '/app/projects/sample-fieldnote'
const bar = (page: Page) => page.getByTestId('workflow-bar')
const sections = ['', '/fonts', '/typography', '/typeface', '/export', '/settings']

test.describe('workflow bar', () => {
  test('is on every screen of a project, shows where you are, and says what is next', async ({ page }) => {
    await page.goto(SAMPLE)
    for (const sub of sections) {
      await page.goto(SAMPLE + sub)
      await expect(bar(page), sub || 'overview').toBeVisible()
      await expect(bar(page).getByRole('navigation', { name: 'Workflow steps' }).getByRole('link')).toHaveCount(8)
    }
    // Where you are follows the screen and the section.
    const here = (p: Page) => bar(p).locator('[aria-current="step"]')
    await page.goto(SAMPLE)
    await expect(here(page)).toContainText('Brand')
    await page.goto(SAMPLE + '/fonts')
    await expect(here(page)).toContainText('Fonts')
    await page.goto(SAMPLE + '/typography#scale')
    await expect(here(page)).toContainText('Scale')
    await page.goto(SAMPLE + '/typography#previews')
    await expect(here(page)).toContainText('Preview')
    await page.goto(SAMPLE + '/typeface')
    await expect(here(page)).toContainText('Typeface')
    // The sample is finished except for validation and export; the next step is the first that is not done.
    await expect(bar(page).getByTestId('workflow-next')).toContainText('Validate')
  })

  test('stays in view while the page scrolls, below the top bar', async ({ page }) => {
    await page.goto(SAMPLE + '/typography')
    await expect(page.locator('#previews')).toBeVisible() // the page is long once it has rendered
    await page.evaluate(() => scrollTo(0, 1200))
    await page.waitForTimeout(200)
    const box = (await bar(page).boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(54)
    expect(box.y).toBeLessThan(62) // pinned under the 56px top bar
    await expect(bar(page).getByRole('button', { name: /Workflow/ })).toBeVisible()
  })

  test('Brand direction jumps to its section: scrolls there, focuses the heading, washes the section, and answers a second click too', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(SAMPLE)
    const row = page.locator('li[data-step="brand"]')
    const section = page.locator('#brand')
    const top = () => section.evaluate((e) => e.getBoundingClientRect().top)
    expect(await top()).toBeGreaterThan(780) // below the fold to begin with
    await row.getByRole('link').click()
    await expect(page).toHaveURL(/#brand$/)
    await expect(section).toHaveAttribute('data-arrive', '')
    await expect.poll(top).toBeLessThan(260) // arrived, below the sticky bars
    expect(await top()).toBeGreaterThan(100)
    await expect(page.getByRole('heading', { name: 'Brand direction' })).toBeFocused()
    // The address already says #brand: a plain link would now do nothing. This one answers again.
    await page.evaluate(() => scrollTo(0, 0))
    await expect.poll(top).toBeGreaterThan(780)
    await row.getByRole('link').click()
    await expect.poll(top).toBeLessThan(260)
    await expect(section).toHaveAttribute('data-arrive', '')
  })

  test('the whole row is the target, not only the word "Open"', async ({ page }) => {
    await page.goto(SAMPLE)
    const row = page.locator('li[data-step="fonts"]')
    const b = (await row.boundingBox())!
    await page.mouse.click(b.x + 200, b.y + b.height / 2) // on the title, away from the link
    await expect(page).toHaveURL(/\/fonts$/)
  })

  test('from another screen, Brand in the bar takes you to the Brand direction section', async ({ page }) => {
    await page.goto(SAMPLE + '/fonts')
    await bar(page).getByRole('navigation', { name: 'Workflow steps' }).getByRole('link', { name: /Brand/ }).click()
    await expect(page).toHaveURL(/\/sample-fieldnote#brand$/)
    await expect(page.getByRole('heading', { name: 'Brand direction' })).toBeVisible()
    await expect.poll(() => page.locator('#brand').evaluate((e) => e.getBoundingClientRect().top)).toBeLessThan(260)
  })

  test('the typography steps land on their own sections, below the bars', async ({ page }) => {
    await page.goto(SAMPLE)
    await bar(page).getByRole('navigation', { name: 'Workflow steps' }).getByRole('link', { name: /Scale/ }).click()
    await expect(page).toHaveURL(/typography#scale$/)
    await expect.poll(() => page.locator('#scale').evaluate((e) => e.getBoundingClientRect().top)).toBeLessThan(260)
    await expect(page.locator('#scale')).toHaveAttribute('data-arrive', '')
  })

  test('the Workflow button opens a side panel with every step, which fits the screen and closes on Escape with focus back', async ({ page }) => {
    await page.goto(SAMPLE + '/fonts')
    const open = bar(page).getByRole('button', { name: /Workflow/ })
    await open.click()
    const drawer = page.getByRole('complementary', { name: 'Workflow' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('list', { name: 'All workflow steps' }).getByRole('listitem')).toHaveCount(8)
    await expect(drawer.locator('[aria-current="step"]')).toContainText('Select font families')
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
    const b = (await drawer.boundingBox())!
    const vp = page.viewportSize()!
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 1)
    expect(b.y).toBeGreaterThanOrEqual(0)
    expect(b.height).toBeGreaterThan(vp.height - 4) // the full height of the screen, not clipped inside the bar
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    await expect(open).toBeFocused()
  })

  test('choosing a step in the panel goes there and closes the panel', async ({ page }) => {
    await page.goto(SAMPLE)
    await bar(page).getByRole('button', { name: /Workflow/ }).click()
    const drawer = page.getByRole('complementary', { name: 'Workflow' })
    await drawer.getByRole('link', { name: /Export/ }).click()
    await expect(page).toHaveURL(/\/export$/)
    await expect(drawer).toHaveCount(0)
  })

  test('progress follows the work: a new project starts at none, and filling in the brand moves it', async ({ page }) => {
    await createProject(page, 'Progress')
    const progress = page.getByTestId('workflow-progress').getByRole('progressbar')
    const before = Number(await progress.getAttribute('aria-valuenow'))
    await page.getByLabel('Brand name').fill('Northwind')
    await page.getByText('Technical', { exact: true }).click()
    await page.getByText('SaaS and software', { exact: true }).click()
    await expect.poll(async () => Number(await progress.getAttribute('aria-valuenow'))).toBeGreaterThan(before)
    await expect(bar(page).locator('[data-bar-step="brand"]')).toHaveAttribute('data-state', 'done')
    await expect(bar(page).getByRole('button', { name: /Workflow/ })).toContainText(/\d\/\d/)
  })

  test('on a phone the steps collapse into the Workflow button, the current step and Next, and the panel fits', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(SAMPLE + '/fonts')
    // The steps are the navigation on a phone too: a second row, with only the current step named.
    const steps = bar(page).getByRole('navigation', { name: 'Workflow steps' })
    await expect(steps.getByRole('link')).toHaveCount(8)
    await expect(steps.getByRole('link', { name: 'Fonts', exact: true })).toContainText('Fonts')
    expect(await steps.getByRole('link', { name: 'Roles', exact: true }).locator('span').last().evaluate((e) => e.getBoundingClientRect().width)).toBeLessThanOrEqual(1) // named for screen readers, drawn as a marker
    const nb = (await steps.boundingBox())!
    expect(nb.x + nb.width).toBeLessThanOrEqual(391)
    await expect(bar(page).getByTestId('workflow-next')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true) // nothing overflows sideways
    await bar(page).getByRole('button', { name: /Workflow/ }).click()
    const drawer = page.getByRole('complementary', { name: 'Workflow' })
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)))) // it slides in; measure where it settles
    const b = (await drawer.boundingBox())!
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.x + b.width).toBeLessThanOrEqual(391)
  })

  test('has no serious accessibility violations: the bar, the panel, and the overview with its progress', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme })
      await page.goto(SAMPLE)
      await page.waitForTimeout(1300) // the progress bar and the list finish animating first: axe reads colours mid-animation
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
      let results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      expect(results.violations.map((v) => `${theme} overview ${v.id}: ${v.nodes[0]?.target}`)).toEqual([])
      await bar(page).getByRole('button', { name: /Workflow/ }).click()
      await expect(page.getByRole('complementary', { name: 'Workflow' })).toBeVisible()
      await page.waitForTimeout(700)
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
      results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      expect(results.violations.map((v) => `${theme} panel ${v.id}: ${v.nodes[0]?.target}`)).toEqual([])
    }
  })
})

test.describe('workflow motion', () => {
  test('the progress bar fills from the left when the overview opens, and the list and tab content ease in', async ({ page }) => {
    await page.goto(SAMPLE)
    const fill = page.locator('.progress-fill').first()
    await expect(fill).toBeVisible()
    const anim = await fill.evaluate((e) => e.getAnimations().map((a) => (a as CSSAnimation).animationName))
    expect(anim).toContain('bar-fill')
    expect(await page.locator('ol[aria-label="Brand workflow"] > li').first().evaluate((e) => getComputedStyle(e).animationName)).toBe('rise')
    await page.goto(SAMPLE + '/fonts')
    expect(await page.locator('.route-enter').first().evaluate((e) => getComputedStyle(e).animationName)).toBe('route-in')
  })

  test('with reduced motion nothing moves: no smooth scrolling, no rise or fade of lists and tabs, but the arrival is still marked', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await page.goto(SAMPLE)
    // Animations are cut to a hair (the global rule), so what remains is the end state at once.
    const dur = await page.locator('ol[aria-label="Brand workflow"] > li').first().evaluate((e) => parseFloat(getComputedStyle(e).animationDuration))
    expect(dur).toBeLessThan(0.01)
    await page.locator('li[data-step="brand"]').getByRole('link').click()
    await expect(page.locator('#brand')).toHaveAttribute('data-arrive', '') // still tells you where you landed
    expect(await page.locator('#brand').evaluate((e) => getComputedStyle(e).animationName)).toBe('arrive-wash') // a colour fade, not a movement
    await expect(page.getByRole('heading', { name: 'Brand direction' })).toBeFocused()
    await ctx.close()
  })
})
