import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { PUBLIC_PAGES, pageTitle } from '../src/modules/marketing/seo-config'
import { createProject } from './helpers'

const SITE = 'https://bts.example.test' // matches VITE_SITE_URL in playwright.config.ts
const marketingPaths = PUBLIC_PAGES.map((p) => p.path)

test.describe('public routes', () => {
  for (const p of PUBLIC_PAGES) {
    test(`${p.path} renders with its own title, description and robots`, async ({ page }) => {
      await page.goto(p.path)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
      await expect(page).toHaveTitle(pageTitle(p.title))
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', p.description)
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', p.indexable ? 'index,follow' : 'noindex,nofollow')
      await expect(page.locator('main')).toHaveCount(1)
      if (p.indexable) await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', p.path === '/' ? `${SITE}/` : `${SITE}${p.path}`)
      else await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
    })

    test(`${p.path} ships its metadata in the static HTML (no JavaScript needed)`, async ({ request }) => {
      const html = await (await request.get(p.path)).text()
      expect(html).toContain(`<title>${pageTitle(p.title).replace(/&/g, '&amp;')}</title>`)
      expect(html).toContain('property="og:title"')
      expect(html).toContain('property="og:image" content="https://bts.example.test/og.png"')
      expect(html).toContain(p.indexable ? 'index,follow' : 'noindex,nofollow')
    })
  }

  test('sitemap lists indexable pages only, robots points to it', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    for (const p of PUBLIC_PAGES) expect(sitemap.includes(`<loc>${SITE}${p.path === '/' ? '/' : p.path}</loc>`)).toBe(p.indexable)
    const robots = await (await request.get('/robots.txt')).text()
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`)
    expect(robots).toContain('Disallow: /app/')
    expect((await request.get('/og.png')).headers()['content-type']).toBe('image/png')
  })
})

test('application routes are never indexed and have their own titles', async ({ page }) => {
  await page.goto('/app/projects')
  await expect(page).toHaveTitle('Projects · Brand Typography Studio')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow')
  await page.goto('/app/settings')
  await expect(page).toHaveTitle('Settings · Brand Typography Studio')
})

test('/app is the entry point and leads to the dashboard', async ({ page }) => {
  await page.goto('/app')
  await expect(page).toHaveURL(/\/app\/projects$/)
  await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible()
})

test('marketing calls to action reach the app', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Start a project' }).first().click()
  await expect(page).toHaveURL(/\/app\/projects$/)
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Open the studio' }).click()
  await expect(page).toHaveURL(/\/app\/projects$/)
  await page.goto('/pricing')
  await page.getByRole('link', { name: 'Start a project' }).click()
  await expect(page).toHaveURL(/\/app\/projects$/)
  await page.goto('/')
  await page.getByRole('link', { name: 'Try the font lab' }).click()
  await expect(page).toHaveURL(/\/app\/lab$/)
})

test('no dead or placeholder links anywhere on the public site', async ({ page }) => {
  const targets = new Set<string>()
  for (const path of marketingPaths) {
    await page.goto(path)
    for (const a of await page.locator('a').all()) {
      const href = await a.getAttribute('href')
      expect(href, `link without href on ${path}`).toBeTruthy()
      expect(href, `placeholder link on ${path}`).not.toMatch(/^#?$|^javascript:/)
      if (href!.startsWith('/')) targets.add(href!)
      else if (!href!.startsWith('#')) expect(href).toMatch(/^https?:\/\//)
    }
  }
  expect(targets.size).toBeGreaterThan(10)
  for (const t of targets) {
    const response = await page.goto(t)
    expect(response?.status(), t).toBe(200)
    await expect(page.getByText('That page does not exist.'), t).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 }), t).toHaveCount(1)
  }
})

test('the site makes no requests to other origins', async ({ page }) => {
  const foreign: string[] = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http')) foreign.push(r.url())
  })
  for (const path of [...marketingPaths, '/app/projects', '/app/lab', '/app/settings']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
  }
  expect(foreign).toEqual([])
})

test('uses Manrope for the interface', async ({ page }) => {
  await page.goto('/app/projects')
  await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible() // lazy route rendered, text is on screen
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Manrope')
  expect(await page.evaluate(() => document.fonts.check('16px "Manrope Variable"'))).toBe(true)
})

test('home page does not download the heavy font library or example fonts up front', async ({ page }) => {
  const urls: string[] = []
  page.on('request', (r) => urls.push(r.url()))
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(urls.some((u) => /font-flux-js/.test(u))).toBe(false)
})

test.describe('keyboard and touch', () => {
  test('skip link is the first tab stop and jumps to main content', async ({ page }) => {
    await page.goto('/features')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('main')).toBeFocused()
  })

  test('desktop navigation works by keyboard with a visible current page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'FAQ' }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/faq$/)
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'FAQ' })).toHaveAttribute('aria-current', 'page')
  })

  test.describe('on a touch phone', () => {
    test.use({ hasTouch: true, viewport: { width: 375, height: 800 } })
    test('mobile menu opens with Enter, is reachable by Tab, closes with Escape and on navigation', async ({ page }) => {
    await page.goto('/')
    const menu = page.getByRole('button', { name: 'Menu' })
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await menu.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Tab')
    await expect(page.locator('#mobile-nav').getByRole('link', { name: 'Features' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.locator('#mobile-nav')).toHaveCount(0)
    await page.getByRole('button', { name: 'Menu' }).tap()
    await page.locator('#mobile-nav').getByRole('link', { name: 'Pricing' }).tap()
    await expect(page).toHaveURL(/\/pricing$/)
    await expect(page.locator('#mobile-nav')).toHaveCount(0)
    })
  })

  test('app menu on mobile works the same way', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/app/projects')
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.locator('#app-menu').getByRole('link', { name: 'Settings' }).click()
    await expect(page).toHaveURL(/\/app\/settings$/)
    await expect(page.locator('#app-menu')).toHaveCount(0)
  })

  test('touch targets on small screens are at least 44px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/app/projects')
    for (const name of ['Menu', 'New project', 'Import project file']) {
      const box = await page.getByRole('button', { name: name, exact: true }).boundingBox()
      expect(box!.height, name).toBeGreaterThanOrEqual(44)
    }
  })
})

async function noOverflow(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, path).toBeLessThanOrEqual(0)
}

test('no horizontal scroll at phone width on any route', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  for (const path of [...marketingPaths, '/app/projects', '/app/lab', '/app/settings']) await noOverflow(page, path)
  await createProject(page, 'Phone')
  const base = page.url()
  for (const section of ['', '/typography', '/typeface', '/export', '/settings']) await noOverflow(page, base + section)
  await page.goto(`${base}/typeface`)
  await page.getByRole('button', { name: /Start with Geometric/ }).click()
  await expect(page.getByLabel('Typeface name')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'preview view').toBeLessThanOrEqual(0)
  await page.getByRole('button', { name: 'Glyphs', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'glyphs view').toBeLessThanOrEqual(0)
})

test.describe('accessibility (axe, serious and critical only)', () => {
  const check = async (page: Page, path: string) => {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), path).toEqual([])
  }
  for (const path of marketingPaths) test(`public ${path}`, ({ page }) => check(page, path))
  for (const path of ['/app/projects', '/app/lab', '/app/settings']) test(`app ${path}`, ({ page }) => check(page, path))
  test('typeface creator views and glyph panel', async ({ page }) => {
    await createProject(page, 'A11y face', 'Custom Typeface Creator')
    await page.getByRole('button', { name: /Start with Rounded/ }).click()
    await expect(page.getByLabel('Typeface name')).toBeVisible()
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), label).toEqual([])
    }
    for (const view of ['Preview', 'Glyphs', 'Variants', 'Coverage']) {
      await page.getByRole('button', { name: view, exact: true }).click()
      await page.waitForTimeout(300)
      await scan(view)
    }
    await page.getByRole('button', { name: 'Glyphs', exact: true }).click()
    await page.getByRole('button', { name: /^A, supported/ }).click()
    const panel = page.getByRole('complementary', { name: 'Glyph A' })
    await expect(panel).toBeVisible()
    // The drawer fades in over 260ms; scan once it has settled so contrast is measured on opaque text.
    await expect.poll(() => panel.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
    await scan('glyph panel')
  })

  test('project sections', async ({ page }) => {
    await createProject(page, 'A11y')
    const base = page.url()
    for (const s of ['', '/typography', '/typeface', '/export', '/settings']) await check(page, base + s)
  })
})

test('home page example families load when scrolled into view', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Open-licensed fonts that appear on this site')).toBeVisible()
  await page.getByRole('heading', { name: 'Example typography families' }).scrollIntoViewIfNeeded()
  await expect(page.getByText('IBM Plex Mono', { exact: true })).toBeVisible()
  await expect(page.getByText('Fraunces', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: /Generated geometric typeface specimen reading Ag/ })).toBeVisible()
})
