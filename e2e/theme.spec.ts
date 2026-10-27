import { expect, test, type Page } from '@playwright/test'

const theme = (page: Page) => page.evaluate(() => document.documentElement.getAttribute('data-theme'))
const stored = (page: Page) => page.evaluate(() => localStorage.getItem('tynovo.theme'))
const pageBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor === 'rgba(0, 0, 0, 0)' ? getComputedStyle(document.documentElement).backgroundColor : getComputedStyle(document.body).backgroundColor)
const choose = async (page: Page, name: 'Light' | 'Dark' | 'System') => {
  await page.getByRole('button', { name: 'Colour theme' }).click()
  await page.getByRole('menuitemradio', { name }).click()
}

test.describe('colour theme', () => {
  test('it follows the system until the person chooses, and writes nothing while it does', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    expect(await theme(page)).toBe('dark')
    expect(await pageBg(page)).toBe('rgb(18, 16, 14)') // #12100e
    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(() => theme(page)).toBe('light') // live, while the preference is System
    expect(await pageBg(page)).toBe('rgb(255, 255, 255)')
    expect(await stored(page)).toBeNull()
  })

  test('Light, Dark and System are a radio choice in a menu, the current one checked, and the choice is kept', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await page.getByRole('button', { name: 'Colour theme' }).click()
    const items = page.getByRole('menuitemradio')
    await expect(items).toHaveText(['Light', 'Dark', 'System'])
    await expect(page.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')

    await choose(page, 'Dark')
    expect(await theme(page)).toBe('dark')
    expect(await stored(page)).toBe('dark')
    await page.goto('/app/projects') // another page, still dark
    expect(await theme(page)).toBe('dark')
    await page.reload()
    expect(await theme(page)).toBe('dark') // and after a reload, against a light system
    await page.getByRole('button', { name: 'Colour theme' }).click()
    await expect(page.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')

    await choose(page, 'Light')
    expect(await stored(page)).toBe('light')
    await choose(page, 'System')
    expect(await stored(page)).toBeNull() // choosing System removes the stored value again
  })

  test('the theme is applied before any application code runs, so there is no flash of the wrong colours', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.addInitScript(() => localStorage.setItem('tynovo.theme', 'dark'))
    await page.route('**/assets/*.js', (r) => r.abort()) // the whole app bundle is blocked: only /theme-init.js can have run
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    expect(await theme(page)).toBe('dark')
    expect(await pageBg(page)).toBe('rgb(18, 16, 14)')
  })

  test('the init script is a classic blocking script ahead of the app, not an inline one', async ({ request }) => {
    const html = await (await request.get('/')).text()
    const init = html.indexOf('<script src="/theme-init.js"></script>')
    const app = html.indexOf('type="module"')
    expect(init).toBeGreaterThan(-1)
    expect(init).toBeLessThan(app)
    expect((await request.get('/theme-init.js')).ok()).toBe(true)
  })

  test('if the browser blocks storage the choice still holds while you move around', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError') }, configurable: true }))
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/app/projects')
    await choose(page, 'Dark')
    expect(await theme(page)).toBe('dark')
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await page.getByRole('link', { name: 'Projects', exact: true }).first().click()
    expect(await theme(page)).toBe('dark')
  })

  test('the logo stays legible in dark: its grey is lightened, its orange is unchanged', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    const fills = await page.locator('header svg').first().locator('path').evaluateAll((ps) => ps.map((p) => getComputedStyle(p).fill))
    expect(fills).toContain('rgb(199, 69, 4)') // #c74504
    expect(fills.some((f) => f === 'rgb(231, 226, 216)')).toBe(true) // #e7e2d8, not the light-theme #444444
  })
})

test.describe('the website header', () => {
  test('the navigation is centred on the page, with the logo left and the actions right', async ({ page }) => {
    for (const width of [1100, 1440, 1920]) {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      const nav = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!
      const logo = (await page.locator('header a').first().boundingBox())!
      const action = (await page.getByRole('link', { name: 'Open Tynovo' }).first().boundingBox())!
      expect(Math.abs(nav.x + nav.width / 2 - width / 2), `nav centre @${width}`).toBeLessThanOrEqual(1)
      expect(logo.x + logo.width, 'logo is left of the nav').toBeLessThan(nav.x)
      expect(action.x, 'actions are right of the nav').toBeGreaterThan(nav.x + nav.width)
    }
  })

  test('on a phone the theme menu sits beside the hamburger', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Colour theme' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden()
  })
})
