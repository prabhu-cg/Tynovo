import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { PUBLIC_PAGES } from '../src/modules/marketing/seo-config'
import { createProject } from './helpers'

/**
 * WCAG 2.2 AA review. axe covers what a machine can judge (contrast, names, roles, target size); the tests below it cover
 * what it cannot: where focus goes, what is announced, and whether anything is said by colour alone.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function violations(page: Page, where: string) {
  // A drawer fades in; axe reads colours as drawn, so a half-faded panel would report a contrast that nobody sees.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity)) // endless decorative loops (the 404 mark) never finish
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  return r.violations.map((v) => `${where}: [${v.impact}] ${v.id} - ${v.help}: ${v.nodes.slice(0, 4).map((n) => n.target.join(' ')).join(' | ')}`)
}

const SIZES = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 844 },
] as const

for (const scheme of ['light', 'dark'] as const) test.describe(`axe, WCAG 2.2 AA, every impact level, ${scheme} theme`, () => {
  test.use({ colorScheme: scheme })
  for (const size of SIZES) {
    test(`public pages and the not-found page, ${size.name}`, async ({ page }) => {
      await page.setViewportSize(size)
      const found: string[] = []
      for (const p of PUBLIC_PAGES) {
        await page.goto(p.path)
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
        found.push(...(await violations(page, `${size.name} ${p.path}`)))
      }
      await page.goto('/app/does/not/exist')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      found.push(...(await violations(page, `${size.name} not-found`)))
      expect(found).toEqual([])
    })

    test(`application: dashboard, every project section, typeface views, export, settings, ${size.name}`, async ({ page }) => {
      await page.setViewportSize(size)
      const found: string[] = []
      await createProject(page, 'Access', 'Custom Typeface Creator')
      await page.getByRole('button', { name: /Start with Geometric/ }).click()
      await expect(page.getByLabel('Typeface name')).toBeVisible()
      for (const view of ['Preview', 'Glyphs', 'Variants', 'Coverage', 'Quality', 'Font info']) {
        await page.getByRole('button', { name: view, exact: true }).click()
        await expect(page.getByRole('button', { name: view, exact: true })).toHaveAttribute('aria-current', 'page')
        found.push(...(await violations(page, `${size.name} typeface/${view}`)))
      }
      const nav = page.getByRole('navigation', { name: 'Project sections' })
      for (const section of ['Overview', 'Font catalog', 'Brand Typography System']) {
        await nav.getByRole('link', { name: section }).click()
        await expect(page.getByRole('main')).toBeVisible()
        found.push(...(await violations(page, `${size.name} ${section}`)))
      }
      await page.getByRole('link', { name: 'Export', exact: true }).first().click()
      await expect(page).toHaveURL(/\/export$/)
      found.push(...(await violations(page, `${size.name} export`)))
      await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
      found.push(...(await violations(page, `${size.name} project settings`)))
      for (const path of ['/app/projects', '/app/settings', '/app/lab']) {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        found.push(...(await violations(page, `${size.name} ${path}`)))
      }
      expect(found).toEqual([])
    })
  }
})

for (const scheme of ['light', 'dark'] as const) test.describe(`axe, busy states, ${scheme} theme`, () => {
  test.use({ colorScheme: scheme })
  for (const size of SIZES) {
    test(`open drawers, brand suggestions, a selected glyph and a built export, ${size.name}`, async ({ page }) => {
      test.setTimeout(120_000) // six axe passes and a font build
      await page.setViewportSize(size)
      const found: string[] = []

      await page.goto('/app/projects')
      await page.getByRole('button', { name: /New project|Create your first project/ }).first().click()
      await expect(page.getByRole('complementary', { name: 'New project' })).toBeVisible()
      found.push(...(await violations(page, `${size.name} new-project drawer`)))
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Hide sample project' }).click()
      found.push(...(await violations(page, `${size.name} projects with the sample collapsed`)))
      await page.getByRole('button', { name: 'Show sample project' }).click()

      await createProject(page, 'Busy', 'Custom Typeface Creator')
      await page.goto('/app/projects')
      await page.getByRole('button', { name: 'More actions for Busy' }).click()
      await page.getByRole('menuitem', { name: /^Delete/ }).click()
      await expect(page.getByRole('dialog', { name: 'Delete “Busy”?' })).toBeVisible()
      found.push(...(await violations(page, `${size.name} delete confirmation dialog`)))
      await page.keyboard.press('Escape')
      await page.getByRole('link', { name: 'Busy' }).click()
      await page.getByRole('navigation', { name: 'Project sections' }).getByRole('link', { name: 'Custom Typeface Creator' }).click()
      await page.getByRole('button', { name: /Start with Rounded/ }).click()
      await expect(page.getByLabel('Typeface name')).toBeVisible()

      await page.getByRole('button', { name: 'Glyphs', exact: true }).click()
      await page.getByRole('button', { name: /^H, supported/ }).click()
      await expect(page.getByRole('application', { name: 'Outline of H' })).toBeVisible()
      found.push(...(await violations(page, `${size.name} glyph editor with H selected`)))

      const sections = page.getByRole('navigation', { name: 'Project sections' })
      await sections.getByRole('link', { name: 'Overview' }).click()
      await page.getByText('SaaS and software', { exact: true }).click() // the checkbox is visually hidden inside its label: click the label text
      await page.getByText('Technical', { exact: true }).click()
      await sections.getByRole('link', { name: 'Brand Typography System' }).click()
      await expect(page.getByRole('region', { name: 'Suggested pairings' }).locator('[data-pairing]').first()).toBeVisible()
      found.push(...(await violations(page, `${size.name} brand direction with suggested pairings`)))

      await sections.getByRole('link', { name: 'Font catalog' }).click()
      found.push(...(await violations(page, `${size.name} font catalog with brand ordering`)))

      await page.getByRole('link', { name: 'Export', exact: true }).first().click()
      await page.getByRole('button', { name: /Check and build/ }).click()
      await expect(page.getByRole('complementary', { name: 'Font export' })).toContainText('Built a TrueType (.ttf) file')
      found.push(...(await violations(page, `${size.name} export drawer with a built font`)))

      expect(found).toEqual([])
    })
  }
})

test.describe('keyboard', () => {
  test('the first stop on every page is a skip link that lands on the main content', async ({ page }) => {
    for (const path of ['/', '/app/projects']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible() // the application loads lazily; Tab only means something once it is there
      await page.keyboard.press('Tab')
      const skip = page.getByRole('link', { name: 'Skip to content' })
      await expect(skip).toBeFocused()
      await expect(skip).toBeVisible()
      await page.keyboard.press('Enter')
      const inMain = await page.evaluate(() => document.getElementById('main-content')?.contains(document.activeElement) || document.querySelector('main')?.contains(document.activeElement) || document.activeElement === document.querySelector('main'))
      expect(inMain, path).toBe(true)
    }
  })

  test('every stop reached by Tab shows where focus is', async ({ page }) => {
    await createProject(page, 'Focus', 'Custom Typeface Creator')
    await page.getByRole('button', { name: /Start with Geometric/ }).click()
    await expect(page.getByLabel('Typeface name')).toBeVisible()
    const invisible: string[] = []
    for (let i = 0; i < 45; i++) {
      await page.keyboard.press('Tab')
      const r = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body) return null
        const cs = getComputedStyle(el)
        const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 && cs.outlineColor !== 'rgba(0, 0, 0, 0)'
        const ring = cs.boxShadow !== 'none'
        const label = `${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''} "${(el.textContent ?? '').trim().slice(0, 30)}"`
        return { visible: outline || ring, label, rect: el.getBoundingClientRect().width > 0 }
      })
      if (r && r.rect && !r.visible) invisible.push(r.label)
    }
    expect(invisible).toEqual([])
  })

  test('the new-project drawer takes focus, closes on Escape and gives focus back', async ({ page }) => {
    await page.goto('/app/projects')
    const opener = page.getByRole('button', { name: /New project|Create your first project/ }).first()
    await opener.waitFor()
    await opener.focus()
    await opener.press('Enter')
    const drawer = page.getByRole('complementary', { name: 'New project' })
    await expect(drawer).toBeVisible()
    expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(opener).toBeFocused()
  })

  test('on a phone the drawer covers the page, so focus cannot move to what it hides', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/app/projects')
    await page.getByRole('button', { name: /New project|Create your first project/ }).first().click()
    const drawer = page.getByRole('complementary', { name: 'New project' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByLabel('Project name')).toBeFocused() // the field that asked for focus gets it
    const outside: string[] = []
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      const where = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement
        const aside = document.querySelector('aside[aria-label="New project"]')
        return aside?.contains(el) ? 'in' : `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`
      })
      if (where !== 'in' && !where.startsWith('body ')) outside.push(where) // body = Tab left the page for the browser's own controls
    }
    expect(outside).toEqual([])
  })
})

test.describe('motion, errors and colour', () => {
  test('with reduced motion requested nothing moves: only overlays animate, and only by fading', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/app/projects')
    await page.getByRole('button', { name: /New project|Create your first project/ }).first().click()
    const drawer = page.getByRole('complementary', { name: 'New project' })
    await expect(drawer).toBeVisible()
    expect(await drawer.evaluate((el) => getComputedStyle(el).animationName)).toBe('fade-in') // not the slide
    const offenders = await page.evaluate(() =>
      [...document.querySelectorAll('*:not([data-fade])')].filter((el) => {
        const cs = getComputedStyle(el)
        return parseFloat(cs.transitionDuration) > 0.001 || (cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0.001)
      }).map((el) => el.tagName.toLowerCase()),
    )
    expect(offenders).toEqual([])
  })

  test('an error is announced as an alert and says it is an error in words and with an icon, not by colour alone', async ({ page }) => {
    await page.goto('/app/projects')
    await page.getByLabel('Import project file').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('nope') })
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('not valid JSON')
    await expect(alert).toContainText('Error')
    await expect(alert.locator('svg')).toHaveCount(1)
    expect(await alert.locator('svg').getAttribute('aria-hidden')).toBe('true')
  })

  test('a confirmation says "Done" in words and with an icon', async ({ page }) => {
    await createProject(page, 'Say it', 'Overview')
    await page.goto('/app/projects')
    const status = page.getByRole('status').filter({ hasText: /Done/ })
    // Exporting a project is the quickest action that reports success without changing anything.
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'More actions for Say it' }).click().then(() => page.getByRole('menuitem', { name: /Export/ }).click())])
    expect(download.suggestedFilename()).toMatch(/\.tynovo\.json$/)
    await expect(status.first()).toContainText('Exported “Say it”')
    await expect(status.first().locator('svg')).toHaveCount(1)
  })
})
