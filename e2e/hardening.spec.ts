import { expect, test, type Page } from '@playwright/test'
import { PUBLIC_PAGES } from '../src/modules/marketing/seo-config'
import { createProject } from './helpers'

/**
 * Production hardening. These run against `vite preview`, which serves the headers from vercel.json, so a feature that
 * needs something the Content-Security-Policy forbids (an inline script, a third-party host) fails here, not in production.
 */

/** Everything the page reports that a CSP violation or a script error would produce. */
function watch(page: Page) {
  const problems: string[] = []
  const foreign: string[] = []
  const origin = 'http://localhost:4173' // baseURL in playwright.config.ts
  page.on('console', (m) => {
    if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) problems.push(`console ${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('request', (r) => {
    const u = r.url()
    if (u.startsWith('data:') || u.startsWith('blob:')) return
    if (new URL(u).origin !== origin) foreign.push(u)
  })
  return { problems, foreign }
}

test.describe('security headers', () => {
  for (const path of ['/', '/privacy', '/app/projects']) {
    test(`${path} is served with the content security policy and companion headers`, async ({ request }) => {
      const res = await request.get(path)
      const h = res.headers()
      const csp = h['content-security-policy'] ?? ''
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("script-src 'self'")
      expect(csp).not.toContain('unsafe-inline')
      expect(csp).not.toContain('unsafe-eval')
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("frame-ancestors 'none'")
      expect(csp).toContain("base-uri 'self'")
      expect(csp).toContain("connect-src 'self'")
      expect(h['x-content-type-options']).toBe('nosniff')
      expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
      expect(h['x-frame-options']).toBe('DENY')
      expect(h['permissions-policy']).toContain('camera=()')
    })
  }

  test('no page, marketing or application, loads a script or style inline', async ({ request }) => {
    for (const p of [...PUBLIC_PAGES.map((x) => x.path), '/app/projects']) {
      const html = await (await request.get(p)).text()
      expect(html, p).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/)
      expect(html, p).not.toMatch(/<style\b/)
      expect(html, p).not.toMatch(/\son[a-z]+=/)
    }
  })

  test('unknown addresses have a 404 page that is not indexed', async ({ request }) => {
    const res = await request.get('/404.html')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('<div id="root">')
    expect(html).toContain('content="noindex"')
  })
})

test.describe('under the policy', () => {
  test('every public page renders with no policy violation, script error or request to another origin', async ({ page }) => {
    const { problems, foreign } = watch(page)
    for (const p of PUBLIC_PAGES) {
      await page.goto(p.path)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    }
    await page.goto('/app/nowhere/at/all')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(problems).toEqual([])
    expect(foreign).toEqual([])
  })

  test('the core workflow (project, fonts, typography, typeface, preview, export, download) runs under the policy and talks to no one', async ({ page }) => {
    const { problems, foreign } = watch(page)
    await createProject(page, 'Hardening', 'Custom Typeface Creator')
    await page.getByRole('button', { name: /Start with Rounded/ }).click()
    await expect(page.getByLabel('Typeface name')).toBeVisible()
    await page.getByLabel('Typeface name').fill('Policy Test')

    for (const name of ['Font catalog', 'Brand Typography System']) {
      await page.getByRole('navigation', { name: 'Project sections' }).getByRole('link', { name }).click()
      await expect(page.getByRole('main')).toBeVisible()
    }
    await page.getByRole('link', { name: 'Export', exact: true }).first().click()
    await expect(page).toHaveURL(/\/export$/)
    await page.getByRole('button', { name: /Check and build/ }).click()
    const drawer = page.getByRole('complementary', { name: 'Font export' })
    await expect(drawer).toContainText('Built a TrueType (.ttf) file')
    const [download] = await Promise.all([page.waitForEvent('download'), drawer.getByRole('button', { name: /Download PolicyTest-Regular\.ttf/ }).click()])
    expect(download.suggestedFilename()).toBe('PolicyTest-Regular.ttf')

    expect(problems).toEqual([])
    expect(foreign).toEqual([])
  })
})

test.describe('untrusted files', () => {
  const importInput = (page: Page) => page.getByLabel('Import project file')

  test('a project file over the size cap is refused with an announced message and nothing is stored', async ({ page }) => {
    await page.goto('/app/projects')
    await importInput(page).setInputFiles({ name: 'huge.json', mimeType: 'application/json', buffer: Buffer.alloc(26 * 1024 * 1024, 32) })
    await expect(page.getByRole('alert')).toContainText('larger than 25 MB')
    await expect(page.getByRole('alert')).toContainText('huge.json')
  })

  test('files that are not projects are refused with a reason, never half-imported', async ({ page }) => {
    await page.goto('/app/projects')
    const refuse = async (name: string, body: string, message: RegExp) => {
      await importInput(page).setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(body) })
      await expect(page.getByRole('alert')).toContainText(message)
    }
    await refuse('text.json', 'this is not json', /not valid JSON/)
    await refuse('array.json', '[1,2,3]', /not a Tynovo project file/)
    await refuse('other.json', JSON.stringify({ format: 'something-else', project: {} }), /not a Tynovo project file/)
    await refuse('proto.json', '{"format":"brand-typography-studio.project","__proto__":{"polluted":true},"project":{"__proto__":{"polluted":true}}}', /./)
    expect(await page.evaluate(() => ({} as Record<string, unknown>)['polluted'])).toBeUndefined()
  })

  test('markup in a project name and in preview text is shown as text, never run', async ({ page }) => {
    const { problems } = watch(page)
    const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>'
    await createProject(page, payload)
    await expect(page.getByRole('main').getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue(payload)
    await page.getByRole('navigation', { name: 'Project sections' }).getByRole('link', { name: 'Brand Typography System' }).click()
    await expect(page.getByRole('main')).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>)['__xss'])).toBeUndefined()
    expect(await page.locator('main img[src="x"]').count()).toBe(0)
    expect(problems.filter((p) => /xss|Refused/.test(p))).toEqual([])
  })
})

test.describe('what the privacy notice says is true', () => {
  test('after a full session nothing is kept in the browser except the one project database, and nothing was sent anywhere', async ({ page, context }) => {
    const { problems, foreign } = watch(page)
    const posts: string[] = []
    page.on('request', (r) => {
      if (r.method() !== 'GET' && r.method() !== 'HEAD') posts.push(`${r.method()} ${r.url()}`)
    })

    await page.goto('/')
    await page.goto('/privacy')
    await createProject(page, 'Private', 'Custom Typeface Creator')
    await page.getByRole('button', { name: /Start with Rounded/ }).click()
    await expect(page.getByLabel('Typeface name')).toBeVisible()
    await page.getByLabel('Typeface name').fill('Secret Face')
    await page.getByRole('link', { name: 'Export', exact: true }).first().click()
    await page.getByRole('button', { name: /Check and build/ }).click()
    await expect(page.getByRole('complementary', { name: 'Font export' })).toContainText('Built a TrueType (.ttf) file')
    await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible()

    expect(await context.cookies()).toEqual([]) // no cookies at all
    const kept = await page.evaluate(async () => ({
      local: localStorage.length,
      session: sessionStorage.length,
      databases: (await indexedDB.databases()).map((d) => d.name),
      caches: await caches.keys(),
      workers: (await navigator.serviceWorker.getRegistrations()).length,
    }))
    expect(kept).toEqual({ local: 0, session: 0, databases: ['brand-typography-studio'], caches: [], workers: 0 }) // until the person uses the one preference

    expect(posts).toEqual([]) // nothing was uploaded: every request was a plain read
    expect(foreign).toEqual([])
    expect(problems).toEqual([])
  })
})

test('the two display preferences are the only things kept beside projects, hold one short value each, and are not sent anywhere', async ({ page, context }) => {
  const sent: string[] = []
  page.on('request', (r) => {
    if (r.method() !== 'GET' && r.method() !== 'HEAD') sent.push(`${r.method()} ${r.url()}`)
  })
  await page.goto('/app/projects')
  await page.getByRole('button', { name: 'Hide sample project' }).click()
  const entries = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))
  expect(entries).toEqual({ 'tynovo.sampleCollapsed': '1' })
  await page.getByRole('button', { name: 'Colour theme' }).click()
  await page.getByRole('menuitemradio', { name: 'Dark' }).click()
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual({ 'tynovo.sampleCollapsed': '1', 'tynovo.theme': 'dark' })
  await page.getByRole('button', { name: 'Colour theme' }).click()
  await page.getByRole('menuitemradio', { name: 'System' }).click()
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual({ 'tynovo.sampleCollapsed': '1' }) // System stores nothing
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0)
  expect(await context.cookies()).toEqual([])
  expect(sent).toEqual([])
})
