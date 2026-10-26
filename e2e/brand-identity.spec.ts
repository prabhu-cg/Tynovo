import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createProject } from './helpers'

const NAME = 'Tynovo'
const TAGLINE = 'Shape your brand’s voice'
const PUBLIC = ['/', '/features', '/how-it-works', '/pricing', '/examples', '/licensing', '/faq', '/privacy', '/terms']

test('the header and footer show the Tynovo mark, wordmark and tagline below it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const home = page.getByRole('banner').getByRole('link', { name: `${NAME} ${TAGLINE}` })
  await expect(home).toBeVisible()
  await expect(home.locator('svg[aria-hidden="true"]')).toHaveCount(1)
  const word = home.getByText(NAME, { exact: true })
  const tag = home.getByText(TAGLINE, { exact: true })
  await expect(word).toBeVisible()
  await expect(tag).toBeVisible()
  const [w, t] = [await word.boundingBox(), await tag.boundingBox()]
  expect(t!.y).toBeGreaterThan(w!.y + w!.height - 2) // the tagline sits below the wordmark
  expect(Math.abs(t!.x - w!.x)).toBeLessThan(2) // and lines up with it
  await expect(page.getByRole('contentinfo').getByText(TAGLINE, { exact: true })).toBeVisible()
  // The mark is drawn with the brand colours from the tokens.
  const fills = await home.locator('svg path').evaluateAll((ps) => ps.map((p) => getComputedStyle(p).fill))
  expect(new Set(fills)).toEqual(new Set(['rgb(68, 68, 68)', 'rgb(199, 69, 4)']))
})

test('the lockup fits a phone header and the application sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 })
  await page.goto('/')
  await expect(page.getByRole('banner').getByText(TAGLINE, { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/app/projects')
  const side = page.getByRole('complementary')
  await expect(side.getByText(NAME, { exact: true })).toBeVisible()
  const tag = side.getByText(TAGLINE, { exact: true })
  await expect(tag).toBeVisible()
  expect((await tag.boundingBox())!.height).toBeLessThan(20) // one line, not wrapped
})

test('the old product name is gone from every public page and from the application', async ({ page }) => {
  for (const path of PUBLIC) {
    await page.goto(path)
    await expect(page.getByRole('main').locator('h1, h2').first()).toBeVisible() // lazy pages have rendered
    const text = await page.locator('body').innerText()
    expect(text, path).not.toContain('Brand Typography Studio')
    expect(text, path).toContain(NAME)
    expect(await page.title(), path).toContain(NAME)
  }
  await createProject(page, 'Name check')
  for (const sub of ['', '/fonts', '/typography', '/typeface', '/export', '/settings']) {
    await page.goto(page.url().replace(/\/(fonts|typography|typeface|export|settings)$/, '') + sub)
    await page.waitForLoadState('networkidle')
    expect(await page.locator('body').innerText(), sub).not.toContain('Brand Typography Studio')
    expect(await page.title(), sub).toContain(NAME)
  }
})

test('the favicon set is the supplied logo, served with the right types', async ({ page, request }) => {
  await page.goto('/')
  const links = await page.evaluate(() => [...document.querySelectorAll('head link[rel~="icon"], head link[rel="apple-touch-icon"]')].map((l) => ({ rel: l.getAttribute('rel'), href: l.getAttribute('href'), type: l.getAttribute('type'), sizes: l.getAttribute('sizes') })))
  expect(links).toEqual([
    { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml', sizes: null },
    { rel: 'icon', href: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', type: null, sizes: null },
  ])
  for (const [href, type] of [['/favicon.svg', 'image/svg+xml'], ['/favicon-32.png', 'image/png'], ['/apple-touch-icon.png', 'image/png'], ['/og.png', 'image/png']] as const) {
    const r = await request.get(href)
    expect(r.status(), href).toBe(200)
    expect(r.headers()['content-type'], href).toContain(type)
  }
  // The SVG favicon carries the logo's own outline, in its own colours.
  const svg = await (await request.get('/favicon.svg')).text()
  const supplied = readFileSync(join(process.cwd(), 'public', 'tynovo-logo.svg'), 'utf8').match(/ d="([^"]+)"/g)!.map((m) => m.slice(4, -1))
  expect(supplied.length).toBeGreaterThanOrEqual(3)
  for (const d of supplied) expect(svg, d.slice(0, 20)).toContain(d)
  expect(svg).toContain('#C74504')
  expect(svg).toContain('#444444')
  expect(svg).toMatch(/prefers-color-scheme:dark/) // the grey lightens on a dark tab
  expect((await (await request.get('/apple-touch-icon.png')).body()).subarray(1, 4).toString()).toBe('PNG')
  const og = await page.locator('meta[property="og:image"]').getAttribute('content')
  expect(og).toMatch(/\/og\.png$/)
})
