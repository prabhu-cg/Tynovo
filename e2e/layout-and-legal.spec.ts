import { expect, test, type Locator, type Page } from '@playwright/test'
import { createProject } from './helpers'

const bg = (l: Locator) => l.evaluate((e) => getComputedStyle(e).backgroundColor)
const box = async (l: Locator) => (await l.boundingBox())!
const centred = async (page: Page, l: Locator) => {
  const b = await box(l)
  const vw = page.viewportSize()!.width
  return Math.abs(b.x - (vw - (b.x + b.width)))
}

test.describe('FAQ accordions are centred', () => {
  for (const width of [1280, 1920]) {
    test(`on the home page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      const list = page.locator('#faq details').first().locator('..')
      await list.scrollIntoViewIfNeeded()
      expect(await centred(page, list)).toBeLessThan(2)
      expect((await box(list)).width).toBeLessThanOrEqual(768) // a readable column, not the full width
    })
  }

  test('on the FAQ page, every group is a centred column', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/faq')
    const groups = page.locator('main section[aria-labelledby^="g-"]')
    expect(await groups.count()).toBe(3)
    for (let i = 0; i < 3; i++) expect(await centred(page, groups.nth(i))).toBeLessThan(2)
    await expect(groups.first().locator('details').first()).toBeVisible()
    await groups.first().locator('summary').first().click()
    await expect(groups.first().locator('details').first()).toHaveAttribute('open', '')
  })
})

test.describe('application shell', () => {
  test('the left navigation is cream and the right panel is white', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/app/projects')
    expect(await bg(page.getByRole('complementary'))).toBe('rgb(244, 242, 234)')
    expect(await bg(page.locator('#app-main'))).toBe('rgb(255, 255, 255)')
    // On a project screen too.
    await createProject(page, 'Colours')
    expect(await bg(page.getByRole('complementary'))).toBe('rgb(244, 242, 234)')
    expect(await bg(page.locator('#app-main'))).toBe('rgb(255, 255, 255)')
  })

  test('the content is at most 1440px wide and sits in the middle of the panel on large screens', async ({ page }) => {
    await page.setViewportSize({ width: 2200, height: 900 })
    await page.goto('/app/projects')
    const main = page.locator('#app-main')
    const container = main.locator(':scope > div').first()
    const [m, c] = [await box(main), await box(container)]
    expect(Math.round(c.width)).toBe(1440)
    const left = c.x - m.x
    const right = m.x + m.width - (c.x + c.width)
    expect(Math.abs(left - right)).toBeLessThan(2)
    expect(left).toBeGreaterThan(100) // really centred, not pushed to the edge
    // The same on a project screen, where the old narrower caps are gone.
    await createProject(page, 'Wide')
    const c2 = await box(page.locator('#app-main > div').first())
    expect(Math.round(c2.width)).toBe(1440)
  })

  test('on a smaller screen the content fills the panel instead of staying narrow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/app/projects')
    const [m, c] = [await box(page.locator('#app-main')), await box(page.locator('#app-main > div').first())]
    expect(c.width).toBeGreaterThan(m.width - 90) // panel padding only
    expect(c.width).toBeLessThanOrEqual(1440)
  })

  test('there is no Website link in the left navigation, on desktop or in the phone menu', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/app/projects')
    const nav = page.getByRole('navigation', { name: 'Application' })
    await expect(nav.getByRole('link')).toHaveText(['Projects', 'Font lab', 'Settings'])
    await expect(page.getByRole('link', { name: 'Website', exact: true })).toHaveCount(0)
    await page.setViewportSize({ width: 375, height: 700 })
    await page.reload()
    await page.getByRole('button', { name: 'Open menu' }).click()
    await expect(page.getByRole('navigation', { name: 'Application' }).getByRole('link')).toHaveText(['Projects', 'Font lab', 'Settings'])
  })
})

test.describe('legal pages are complete', () => {
  const PAGES = [
    { path: '/privacy', title: 'Privacy notice', sections: 12, mentions: ['IndexedDB', 'Vercel', 'No cookies are set', 'Your rights', 'legitimate interest'] },
    { path: '/terms', title: 'Terms of use', sections: 15, mentions: ['GNU General Public License', 'No warranty', 'Limits on liability', 'Acceptable use', 'do not choose a particular country'] },
    { path: '/licensing', title: 'Licensed separately, on purpose.', sections: 7, mentions: ['SIL Open Font License 1.1', 'GPL-3.0-only', 'Font Flux JS', 'name table'] },
  ] as const

  for (const p of PAGES) {
    test(`${p.path} has real content, a contents list and no draft or placeholder text`, async ({ page }) => {
      await page.goto(p.path)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.title)
      const text = await page.locator('main').innerText()
      expect(text).not.toMatch(/\bdraft\b|to complete before launch|not yet binding|TODO|lorem|placeholder/i)
      for (const m of p.mentions) expect(text, m).toContain(m)
      expect(text).toContain('Last updated 26 October 2026')
      expect(text.length).toBeGreaterThan(p.path === '/licensing' ? 4000 : 5000)
      if (p.path !== '/licensing') {
        const toc = page.getByRole('navigation', { name: 'On this page' })
        await expect(toc.getByRole('link')).toHaveCount(p.sections)
        await toc.getByRole('link').last().click()
        await expect(page).toHaveURL(new RegExp(`${p.path}#`))
        expect(await page.locator('main section h2').count()).toBe(p.sections)
        await expect(page.getByText('Plain language, not legal advice')).toBeVisible()
      }
      // External links are safe, and none is a placeholder.
      for (const a of await page.locator('main a[href^="http"]').all()) {
        await expect(a).toHaveAttribute('rel', /noopener/)
        expect(await a.getAttribute('href')).toMatch(/^https:\/\//)
      }
    })
  }

  test('privacy and terms name who to contact, with a real address', async ({ page }) => {
    for (const path of ['/privacy', '/terms']) {
      await page.goto(path)
      await expect(page.locator('main a[href="https://github.com/prabhu-cg/Tynovo/issues"]').first()).toBeVisible()
    }
  })

  test('the privacy notice matches what the app really does: no cookies, no storage but projects, no other origins', async ({ page }) => {
    const origins = new Set<string>()
    page.on('request', (r) => origins.add(new URL(r.url()).origin))
    await createProject(page, 'Privacy check')
    await page.goto('/app/projects')
    await page.waitForLoadState('networkidle')
    expect(await page.context().cookies()).toEqual([])
    expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 })
    expect([...origins]).toEqual([new URL(page.url()).origin])
  })

  test('the licensing page lists all bundled fonts with their licence and copyright, and the software it is built with', async ({ page }) => {
    await page.goto('/licensing')
    const rows = page.getByRole('region', { name: 'Fonts bundled with Tynovo' }).locator('tbody tr')
    await expect(rows).toHaveCount(24)
    for (const r of await rows.all()) {
      await expect(r.locator('td').first()).toHaveText('OFL-1.1')
      expect((await r.locator('td').nth(1).innerText()).length).toBeGreaterThan(3)
    }
    await expect(rows.filter({ hasText: 'Manrope' })).toHaveCount(1)
    const software = page.locator('#app li')
    expect(await software.count()).toBe(6)
    await expect(page.getByRole('link', { name: 'LICENSE file' })).toHaveAttribute('href', 'https://github.com/prabhu-cg/Tynovo/blob/main/LICENSE')
  })

  test('the footer links to complete pages, not drafts', async ({ page }) => {
    await page.goto('/')
    const info = page.getByRole('navigation', { name: 'Information' })
    await expect(info.getByRole('link')).toHaveText(['FAQ', 'Licensing', 'Privacy', 'Terms'])
  })
})
