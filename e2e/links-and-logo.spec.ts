import { expect, test, type Page } from '@playwright/test'

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY))

const LINKS = [
  { name: 'Full feature list', url: '/features', h1: /Two modes on one project model/ },
  { name: 'More examples', url: '/examples', h1: /Specimens and illustrative systems/ },
  { name: 'The workflow in detail', url: '/how-it-works', h1: /From a blank project/ },
  { name: 'How pricing is expected to work', url: '/pricing', h1: /Free today/ },
  { name: 'All questions and limitations', url: '/faq', h1: /Questions and limits/ },
] as const

test.describe('links at the foot of the home page open the page from its top', () => {
  for (const l of LINKS) {
    test(l.name, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto('/')
      const link = page.getByRole('link', { name: l.name, exact: true })
      await link.scrollIntoViewIfNeeded()
      const before = await scrollY(page)
      expect(before).toBeGreaterThan(600) // the link is far down the page
      await link.click()
      await expect(page).toHaveURL(new RegExp(`${l.url}$`))
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(l.h1)
      await expect.poll(() => scrollY(page)).toBeLessThan(5) // at the top, not left where the link was
      await expect(page.getByRole('heading', { level: 1 })).toBeInViewport()
      // Back returns to the lower part of the page you were reading (lazy sections can shift it a little), not to the top.
      await page.goBack()
      await expect(page).toHaveURL(/\/$/)
      await expect.poll(async () => Math.abs((await scrollY(page)) - before)).toBeLessThan(250)
    })
  }

  test('a link with an anchor still goes to the anchor', async ({ page }) => {
    await page.goto('/privacy')
    await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Your rights' }).click()
    await expect(page).toHaveURL(/#rights$/)
    await expect(page.getByRole('heading', { name: /Your rights/ })).toBeInViewport()
    expect(await scrollY(page)).toBeGreaterThan(300)
  })

  test('the footer and header links also open pages at the top', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded()
    await page.getByRole('navigation', { name: 'Information' }).getByRole('link', { name: 'Terms' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Terms of use')
    await expect.poll(() => scrollY(page)).toBeLessThan(5)
  })

  test('in the application, opening another page also starts at its top', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 })
    await page.goto('/app/settings')
    await page.getByText('What the Free plan covers').click()
    await page.evaluate(() => window.scrollTo(0, 400))
    await page.getByRole('navigation', { name: 'Application' }).getByRole('link', { name: 'Projects' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeInViewport()
    await expect.poll(() => scrollY(page)).toBeLessThan(5)
  })
})

test('the closing call to action is centred', async ({ page }) => {
  for (const width of [1280, 1920, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const section = page.locator('section[aria-labelledby="cta-h"]')
    await section.scrollIntoViewIfNeeded()
    const h = (await page.locator('#cta-h').boundingBox())!
    expect(Math.abs(h.x + h.width / 2 - width / 2), `heading @${width}`).toBeLessThan(2)
    expect(await page.locator('#cta-h').evaluate((e) => getComputedStyle(e).textAlign)).toBe('center')
    const buttons = section.getByRole('link')
    const boxes = [await buttons.first().boundingBox(), await buttons.last().boundingBox()] as const
    const left = Math.min(boxes[0]!.x, boxes[1]!.x)
    const right = Math.max(boxes[0]!.x + boxes[0]!.width, boxes[1]!.x + boxes[1]!.width)
    expect(Math.abs(left - (width - right)), `buttons @${width}`).toBeLessThan(2)
  }
})

test.describe('the application logo goes to the website', () => {
  test('on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/app/projects')
    const logo = page.getByRole('complementary').getByRole('link', { name: /Tynovo/ })
    await expect(logo).toHaveAttribute('href', '/')
    await expect(logo).toContainText('go to the website')
    await logo.click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Build your brand typography')
    await expect(page.getByRole('link', { name: 'Open Tynovo' }).first()).toBeVisible() // and the way back is there
  })

  test('on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await page.goto('/app/projects')
    const logo = page.getByRole('banner').getByRole('link', { name: /Tynovo/ })
    await expect(logo).toHaveAttribute('href', '/')
    await logo.click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Build your brand typography')
  })

  test('from inside a project too', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/app/projects')
    await page.getByRole('button', { name: 'New project' }).first().click()
    await page.getByRole('complementary', { name: 'New project' }).getByRole('button', { name: 'Create project' }).click()
    await expect(page).toHaveURL(/\/app\/projects\/[^/]+/)
    await page.getByRole('complementary').filter({ hasText: 'Font lab' }).getByRole('link', { name: /Tynovo/ }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})

test('the logo and favicon are the updated mark', async ({ page, request }) => {
  await page.goto('/')
  const svg = await (await request.get('/favicon.svg')).text()
  expect(svg).toContain('viewBox="0 0 123 128"')
  expect(svg).toContain('M0 0H31.195C41.2204') // the updated outline, not the earlier one
  expect(svg).not.toContain('M0 0H23.195')
  const mark = page.getByRole('banner').locator('svg').first()
  expect(await mark.getAttribute('viewBox')).toBe('0 0 123 128')
  const b = (await mark.boundingBox())!
  expect(Math.abs(b.width / b.height - 123 / 128)).toBeLessThan(0.03)
})
