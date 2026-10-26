// Captures the real app, showing the built-in sample project, for the marketing site's laptop mockup.
// Run: npx tsx scripts/make-screens.ts   (or npm run screens)
// Nothing is drawn by hand: these are screenshots of the running application, so they cannot drift from what it
// does without being regenerated. The sample project is fixed, so the output is repeatable.
import { chromium, type Page } from '@playwright/test'
import { createServer } from 'vite'

const PORT = 5199
const BASE = `http://localhost:${PORT}`
const SAMPLE = `${BASE}/app/projects/sample-fieldnote`
const OUT = new URL('../public/screens/', import.meta.url).pathname

/** Same size every time, 16:10 like the laptop's screen, rendered at 1.5x so text stays crisp when scaled down. */
const VIEW = { width: 1280, height: 800 }

const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1.5 })

const settle = async (p: Page) => {
  await p.evaluate(() => document.fonts.ready)
  await p.waitForTimeout(900)
}
const shot = async (name: string) => {
  await settle(page)
  await page.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 86 })
  console.log('wrote', name)
}

try {
  // 1. Overview: the whole workflow, filled in.
  await page.goto(SAMPLE)
  await page.getByText('Brand workflow').waitFor()
  await shot('overview')

  // 2. Font catalog: a font opened with its weights, source and licence.
  await page.getByRole('link', { name: 'Font catalog', exact: true }).click()
  await page.getByRole('button', { name: 'Details of Fraunces' }).click()
  await page.getByTestId('font-sample').and(page.locator('[data-state="loaded"]')).waitFor()
  await page.evaluate(() => window.scrollTo(0, 0))
  await shot('catalog')

  // 3. Typography system: the roles applied in a real layout (the custom typeface is on the display line).
  await page.goto(`${SAMPLE}/typography`)
  await page.getByTestId('custom-font-status').and(page.locator('[data-state="ready"]')).waitFor()
  await page.getByTestId('brand-preview').and(page.locator('[data-custom-font-state="ready"]')).waitFor()
  await page.evaluate(() => document.getElementById('previews')?.scrollIntoView({ block: 'start' }))
  await page.evaluate(() => window.scrollBy(0, -24))
  await shot('typography')

  // 4. Custom typeface: the design controls beside the specimen drawn in the browser from the exported file.
  await page.goto(`${SAMPLE}/typeface`)
  await page.getByTestId('exported-preview').and(page.locator('[data-font-state="ready"]')).waitFor()
  await page.getByTestId('exported-preview').evaluate((e) => e.scrollIntoView({ block: 'center' }))
  await shot('typeface')
} finally {
  await browser.close()
  await server.close()
}
