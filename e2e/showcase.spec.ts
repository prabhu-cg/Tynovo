import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('laptop showcase on the home page', () => {
  test('shows real app screens in a laptop and switches between them', async ({ page }) => {
    await page.goto('/')
    const section = page.locator('#screens')
    await section.scrollIntoViewIfNeeded()
    await expect(section.getByRole('heading', { name: 'See it working' })).toBeVisible()
    const img = section.getByTestId('laptop-screen').locator('img')
    await expect(img).toHaveAttribute('src', '/screens/overview.jpg')
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(1920)

    await section.getByRole('tab', { name: 'Font catalog' }).click()
    await expect(img).toHaveAttribute('src', '/screens/catalog.jpg')
    await expect(img).toHaveAttribute('alt', /Fraunces/)
    await expect(section.getByTestId('screen-caption')).toContainText('licensed font catalog')
  })

  test('tabs work with the keyboard', async ({ page }) => {
    await page.goto('/')
    const section = page.locator('#screens')
    await section.getByRole('tab', { name: 'Overview' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(section.getByRole('tab', { name: 'Font catalog' })).toBeFocused()
    await page.keyboard.press('End')
    await expect(section.getByRole('tab', { name: 'Typeface creator' })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowRight')
    await expect(section.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
  })

  test('links to the sample project, fits a phone and has no accessibility violations', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/')
    const section = page.locator('#screens')
    await section.scrollIntoViewIfNeeded()
    await expect(section.getByRole('link', { name: 'Open the sample project' })).toHaveAttribute('href', '/app/projects/sample-fieldnote')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const results = await new AxeBuilder({ page }).include('#screens').analyze()
    expect(results.violations).toEqual([])
  })
})
