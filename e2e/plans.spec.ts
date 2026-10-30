import { expect, test, type Page } from '@playwright/test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createProject, saved } from './helpers'

const PURCHASE = /buy|purchase|checkout|subscribe|upgrade|sign in|sign up|log in|login|create an account|pricing|price|free trial|discount|coupon|\$\d|€\d|£\d/i

/** Every button and link the person can see on the page, as text. */
const controls = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll('main button, main a, aside a, header a, nav a')].map((e) => `${(e.textContent ?? '').trim()} | ${e.getAttribute('aria-label') ?? ''}`))

test('the free experience is complete without payment or registration', async ({ page }) => {
  const origins = new Set<string>()
  page.on('request', (r) => origins.add(new URL(r.url()).origin))

  // Local projects, a typeface in each procedural family, editing, variants, checks and every export format work.
  await createProject(page, 'Free tier', 'Custom Typeface Creator')
  for (const family of ['Geometric', 'Rounded', 'Modular']) await expect(page.getByRole('button', { name: new RegExp(`Start with ${family}`) })).toBeEnabled()
  await page.getByRole('button', { name: /Start with Modular/ }).click()
  await expect(page.getByLabel('Typeface name')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Family' }).getByRole('radio')).toHaveCount(3)
  await expect(page.getByTestId('locked')).toHaveCount(0)

  await page.getByRole('button', { name: 'Variants', exact: true }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).first().click()
  await expect(page.getByTestId('variant-count')).toHaveText('1 of 60 saved.')

  await page.getByRole('button', { name: 'Quality', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Quality checks' })).toBeVisible()
  await expect(page.getByTestId('locked')).toHaveCount(0)
  await expect(page.getByText('Metric consistency')).toHaveCount(1) // the extended checks are in the list of what ran

  await page.getByRole('button', { name: 'Glyphs', exact: true }).click()
  await page.getByRole('button', { name: /^H, supported/ }).click()
  await expect(page.getByRole('button', { name: 'Insert a point after the selected point' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Stroke thickness' }).first()).toBeVisible()
  await expect(page.getByTestId('locked')).toHaveCount(0)

  await saved(page)
  await page.getByRole('link', { name: 'Export', exact: true }).first().click()
  await expect(page.getByTestId('export-sync')).toContainText('revision')
  for (const title of ['Typography specification', 'Design tokens (JSON)', 'CSS variables and font declarations', 'HTML specimen', 'Sources and licences', 'Project file (backup)', 'Custom font file (TTF)', 'Everything, as one package']) {
    await expect(page.getByRole('button', { name: `Download ${title}`, exact: true }), title).toBeEnabled()
  }
  await expect(page.getByRole('radio', { name: /OpenType/ })).toBeVisible()
  await expect(page.getByTestId('locked')).toHaveCount(0)

  // Settings says what is true.
  await page.goto('/app/settings')
  const plan = page.getByTestId('plan')
  await expect(plan).toContainText('Free. Everything in this version of Tynovo is included.')
  await expect(plan).toContainText('There is no payment system in Tynovo')
  await expect(page.getByText('None. There is no sign-in. The only server code is one small function for the optional AI suggestions.')).toBeVisible()
  await page.getByText('What the Free plan covers').click()
  await expect(page.locator('[data-feature][data-allowed="false"]')).toHaveCount(0)
  expect([...origins]).toEqual([new URL(page.url()).origin]) // no payment, account or analytics service was contacted
})

test('nothing in the application offers to buy, upgrade or sign in', async ({ page }) => {
  await createProject(page, 'Plain project')
  const base = page.url()
  const seen: string[] = []
  for (const path of ['/app/projects', '/app/settings', '/app/lab', base, `${base}/fonts`, `${base}/typography`, `${base}/typeface`, `${base}/export`, `${base}/settings`]) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    seen.push(...(await controls(page)))
  }
  expect(seen.length).toBeGreaterThan(40)
  expect(seen.filter((t) => PURCHASE.test(t))).toEqual([])
  // Nor is there a form that takes a card, an email for an account or a password.
  for (const path of ['/app/settings', base]) {
    await page.goto(path)
    expect(await page.locator('input[type=password], input[autocomplete*="cc-"], input[type=email]').count()).toBe(0)
  }
})

test('a claim made in the browser does not change the plan', async ({ page }) => {
  await page.goto('/app/settings?plan=paid&tier=paid&premium=1')
  await page.evaluate(() => {
    for (const k of ['plan', 'tier', 'entitlements', 'premium', 'paid', 'subscription', 'bts.plan']) {
      localStorage.setItem(k, 'paid')
      sessionStorage.setItem(k, 'paid')
      document.cookie = `${k}=paid`
    }
    ;(window as unknown as Record<string, unknown>)['__plan'] = 'paid'
    window.name = 'plan=paid'
  })
  await page.reload()
  await expect(page.getByTestId('plan')).toContainText('Free.')
  await expect(page.getByText('Development preview')).toHaveCount(0)
  await page.getByText('What the Free plan covers').click()
  await expect(page.getByRole('list', { name: 'Features' }).locator('[data-feature]').first()).toBeVisible()
})

test('the production bundle contains no way to preview or switch a tier', async () => {
  const dir = join(process.cwd(), 'dist', 'assets')
  const js = readdirSync(dir).filter((f) => f.endsWith('.js'))
  expect(js.length).toBeGreaterThan(3)
  for (const f of js) {
    const text = readFileSync(join(dir, f), 'utf8')
    expect(text.includes('dev-preview'), `${f} contains the development preview source`).toBe(false)
    expect(text.includes('Tier previews exist only'), `${f} contains the preview function`).toBe(false)
    expect(text.includes('Development preview of the'), `${f} contains the preview banner`).toBe(false)
  }
})
