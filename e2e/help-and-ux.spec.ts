import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createProject } from './helpers'

const SAMPLE = '/app/projects/sample-fieldnote'
const settle = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))

test.describe('one way around a project', () => {
  test('the section tabs are gone: the workflow steps are the navigation, and they reach every screen', async ({ page }) => {
    await page.goto(SAMPLE)
    await expect(page.getByRole('navigation', { name: 'Project sections' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Custom Typeface Creator' })).toHaveCount(0)
    const steps = page.getByTestId('workflow-bar').getByRole('navigation', { name: 'Workflow steps' })
    for (const [link, url] of [['Fonts', /\/fonts$/], ['Roles', /\/typography#roles$/], ['Typeface', /\/typeface$/], ['Export', /\/export$/], ['Brand', /sample-fieldnote#brand$/]] as const) {
      await steps.getByRole('link', { name: link, exact: true }).click()
      await expect(page).toHaveURL(url)
    }
    // The way back to the top of the overview is in the Workflow panel.
    await page.getByTestId('workflow-bar').getByRole('button', { name: /Workflow/ }).click()
    await page.getByRole('complementary', { name: 'Workflow' }).getByRole('link', { name: /Project overview/ }).click()
    await expect(page).toHaveURL(/sample-fieldnote$/)
  })

  test('there is one "next" button, in the bar, and the overview does not repeat it', async ({ page }) => {
    await createProject(page, 'One CTA')
    await expect(page.getByTestId('workflow-next')).toHaveCount(1)
    await expect(page.getByRole('link', { name: /Continue with/ })).toHaveCount(0)
    await expect(page.getByTestId('workflow-progress')).toBeVisible() // the progress is still there
  })
})

test.describe('screens and specimens', () => {
  test('project settings says what it is', async ({ page }) => {
    await page.goto(SAMPLE + '/settings')
    await expect(page.getByRole('heading', { level: 2, name: 'Project settings' })).toBeVisible()
    await expect(page.getByText(/Duplicate, back up, inspect or delete/)).toBeVisible()
  })

  test('the role samples have room for descenders: the g of Hamburgefonstiv is not cut off, even in a display role with a tight line height', async ({ page }) => {
    await page.goto(SAMPLE + '/typography#roles')
    const samples = page.getByTestId('role-sample')
    await expect(samples.first()).toBeVisible()
    for (const s of await samples.all()) {
      const m = await s.evaluate((e) => ({ client: e.clientHeight, scroll: e.scrollHeight, size: parseFloat(getComputedStyle(e).fontSize), lh: parseFloat(getComputedStyle(e).lineHeight) }))
      expect(m.lh / m.size, 'line height leaves room below the baseline').toBeGreaterThanOrEqual(1.25)
      expect(m.scroll, 'nothing is clipped vertically').toBeLessThanOrEqual(m.client + 1)
    }
  })
})

test.describe('side panels', () => {
  test('a drawer slides in from the right (travelling right to left) and goes back out to the right', async ({ page }) => {
    await page.goto(SAMPLE)
    await page.getByRole('button', { name: 'Help' }).click()
    const drawer = page.getByRole('complementary', { name: 'Help' })
    await expect(drawer).toBeVisible()
    const frames = (open: boolean) => drawer.evaluate((e, o) => (e.getAnimations()[0]!.effect as KeyframeEffect).getKeyframes().map((k) => String(k['transform'])).join(' > ') + (o ? '' : ''), open)
    expect(await frames(true)).toMatch(/^translate(X)?\(100%\) > none$/)
    await settle(page)
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveAttribute('data-closing', 'true')
    expect(await frames(false)).toMatch(/^none > translate(X)?\(100%\)$/)
    await expect(drawer).toHaveCount(0)
  })
})

test.describe('help', () => {
  test('opens from the top bar, explains the screen you are on, and follows you as you move', async ({ page }) => {
    await page.goto(SAMPLE + '/typography')
    const open = page.getByRole('button', { name: 'Help' })
    await open.click()
    const drawer = page.getByRole('complementary', { name: 'Help' })
    await expect(drawer.getByTestId('help-screen')).toContainText('Brand Typography System')
    await expect(drawer.getByTestId('help-screen')).toContainText('Roles, pairing, the type scale')
    // Pressing the dimmed page closes it (and does nothing else); opened again on another screen it explains that one.
    await page.mouse.click(20, 400)
    await expect(drawer).toHaveCount(0)
    await expect(page).toHaveURL(/\/typography$/)
    await page.getByTestId('workflow-bar').getByRole('navigation', { name: 'Workflow steps' }).getByRole('link', { name: 'Fonts', exact: true }).click()
    await expect(page).toHaveURL(/\/fonts$/)
    await expect(drawer).toHaveCount(0)
    await open.click()
    await expect(drawer.getByTestId('help-screen')).toContainText('Font catalog')
    // Topics open on demand.
    await drawer.locator('[data-topic="keys"] summary').click()
    await expect(drawer.locator('[data-topic="keys"]')).toContainText('C turns the segment after a point into a curve')
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
  })

  test('closing it with Escape puts focus back on the Help button', async ({ page }) => {
    await page.goto(SAMPLE)
    const open = page.getByRole('button', { name: 'Help' })
    await open.click()
    await expect(page.getByRole('complementary', { name: 'Help' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('complementary', { name: 'Help' })).toHaveCount(0)
    await expect(open).toBeFocused()
  })

  test('has help for every screen, including the project list and the settings pages', async ({ page }) => {
    const cases: Array<[string, string]> = [['/app/projects', 'Projects'], [SAMPLE, 'Overview and brand direction'], [SAMPLE + '/fonts', 'Font catalog'], [SAMPLE + '/typography', 'Brand Typography System'], [SAMPLE + '/typeface', 'Custom Typeface Creator'], [SAMPLE + '/export', 'Export'], [SAMPLE + '/settings', 'Project settings'], ['/app/settings', 'Settings'], ['/app/lab', 'Font lab']]
    for (const [url, title] of cases) {
      await page.goto(url)
      await page.getByRole('button', { name: 'Help' }).click()
      await expect(page.getByRole('complementary', { name: 'Help' }).getByTestId('help-screen').locator('p').first(), url).toHaveText(title)
      await page.keyboard.press('Escape')
    }
  })

  test('the ? key opens and closes it from anywhere except a text field', async ({ page }) => {
    await page.goto(SAMPLE)
    await expect(page.getByTestId('workflow-bar')).toBeVisible() // the page is up, so its key handler is
    await page.keyboard.press('?')
    await expect(page.getByRole('complementary', { name: 'Help' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('complementary', { name: 'Help' })).toHaveCount(0)
    await page.getByRole('main').getByRole('textbox', { name: 'Project name', exact: true }).focus()
    await page.keyboard.press('?')
    await expect(page.getByRole('complementary', { name: 'Help' })).toHaveCount(0) // typing a question mark in a field is typing
  })

  test('Help and Workflow share the edge: opening one closes the other', async ({ page }) => {
    await page.goto(SAMPLE)
    await page.getByRole('button', { name: 'Help' }).click()
    await expect(page.getByRole('complementary', { name: 'Help' })).toBeVisible()
    await page.getByTestId('workflow-bar').getByRole('button', { name: /Workflow/ }).focus() // the dimmed page takes no pointer, so open it from the keyboard
    await page.keyboard.press('Enter')
    await expect(page.getByRole('complementary', { name: 'Workflow' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Help' })).toHaveCount(0)
  })

  test('on a phone it covers the screen and fits; and it has no serious accessibility violations', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(SAMPLE + '/typeface')
    await page.getByRole('button', { name: 'Help' }).click()
    const drawer = page.getByRole('complementary', { name: 'Help' })
    await settle(page)
    const b = (await drawer.boundingBox())!
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.x + b.width).toBeLessThanOrEqual(391)
    await drawer.locator('[data-topic="ai"] summary').click()
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme })
      await settle(page)
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      expect(r.violations.map((v) => `${theme} ${v.id}: ${v.nodes[0]?.target}`)).toEqual([])
    }
  })
})

test('pressing anywhere outside a drawer closes it, and pressing inside does not', async ({ page }) => {
  await createProject(page, 'Outside')
  await page.getByRole('button', { name: /^Workflow/ }).click()
  const drawer = page.getByRole('complementary', { name: 'Workflow' })
  await expect(drawer).toBeVisible()
  await drawer.getByRole('heading', { name: 'Workflow' }).click()
  await expect(drawer).toBeVisible()
  await page.getByRole('main').click({ position: { x: 5, y: 5 } })
  await expect(drawer).toHaveCount(0)
})
