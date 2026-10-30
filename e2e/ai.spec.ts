import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Route } from '@playwright/test'
import { createProject, readProjects, saved } from './helpers'

const BRAND = { ok: true, task: 'brand', data: { personality: ['warm', 'unhurried'], useCases: ['consumer', 'editorial'], tones: ['friendly', 'elegant'], readabilityPriority: 4, displayPriority: 2, rationale: 'Long tasting notes need easy reading.' } }
const TYPEFACE = { ok: true, task: 'typeface', data: { family: 'rounded', cornerStyle: 'round', terminal: 'round', values: { strokeThickness: 120, roundness: 0.8 }, rationale: 'Chunky and soft.' } }

/** Answer /api/ai with a fixed body, and record what the page sent. */
async function mockAi(page: Page, body: unknown, status = 200) {
  const sent: Array<{ task: string; text: string }> = []
  await page.route('**/api/ai', async (route: Route) => {
    sent.push(route.request().postDataJSON())
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return sent
}

async function startTypeface(page: Page) {
  await createProject(page, 'Assist test', 'Custom Typeface Creator')
  await page.getByRole('button', { name: /Start with Geometric/ }).click()
  await expect(page.getByLabel('Typeface name')).toBeVisible()
}

test.describe('AI assist: brand direction', () => {
  test('sends only the brief, only when asked, shows a suggestion, and changes nothing until it is applied', async ({ page }) => {
    const sent = await mockAi(page, BRAND)
    await createProject(page, 'Roastery')
    const assist = page.getByTestId('brand-assist')
    await assist.locator('summary').click()
    expect(sent).toHaveLength(0) // nothing is sent by opening the page or the box
    await assist.getByLabel('Describe the brand in a few sentences').fill('A small roastery that sells coffee by subscription. Warm and unhurried.')
    await assist.getByRole('button', { name: 'Suggest a direction' }).click()
    const suggestion = page.getByTestId('brand-suggestion')
    await expect(suggestion).toContainText('warm, unhurried')
    await expect(suggestion).toContainText('Long tasting notes need easy reading.')
    expect(sent).toEqual([{ task: 'brand', text: 'A small roastery that sells coffee by subscription. Warm and unhurried.' }]) // the brief and nothing from the project
    await saved(page)
    expect((await readProjects(page))[0]!['brand'].personality).toEqual([]) // not applied yet

    await suggestion.getByRole('button', { name: 'Apply to brand direction' }).click()
    await expect(suggestion).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Remove warm' })).toBeVisible()
    await saved(page)
    const brand = (await readProjects(page))[0]!['brand']
    expect(brand).toMatchObject({ personality: ['warm', 'unhurried'], useCases: ['consumer', 'editorial'], tones: ['friendly', 'elegant'], readabilityPriority: 4, displayPriority: 2 })
  })

  test('ignoring a suggestion leaves the brand as it was', async ({ page }) => {
    await mockAi(page, BRAND)
    await createProject(page, 'Ignore')
    const assist = page.getByTestId('brand-assist')
    await assist.locator('summary').click()
    await assist.getByLabel('Describe the brand in a few sentences').fill('A bank for people who hate banks, plain-spoken and calm.')
    await assist.getByRole('button', { name: 'Suggest a direction' }).click()
    await page.getByRole('button', { name: 'Ignore' }).click()
    await expect(page.getByTestId('brand-suggestion')).toHaveCount(0)
    await saved(page)
    expect((await readProjects(page))[0]!['brand'].personality).toEqual([])
  })

  test('a brief that is too short is not sent; a refusal, a failure and a missing function each say so in words, and nothing breaks', async ({ page }) => {
    const sent = await mockAi(page, { ok: false, error: 'rate-limited', message: 'Too many suggestions in a short time. Wait a few minutes and try again.' }, 429)
    await createProject(page, 'Errors')
    const assist = page.getByTestId('brand-assist')
    await assist.locator('summary').click()
    const box = assist.getByLabel('Describe the brand in a few sentences')
    await box.fill('short')
    await expect(assist.getByRole('button', { name: 'Suggest a direction' })).toBeDisabled()
    await box.fill('A small roastery that sells coffee by subscription.')
    await assist.getByRole('button', { name: 'Suggest a direction' }).click()
    await expect(assist.getByRole('status')).toContainText('Too many suggestions in a short time')
    expect(sent).toHaveLength(1)

    await page.unroute('**/api/ai')
    await page.route('**/api/ai', (route) => route.abort())
    await assist.getByRole('button', { name: 'Suggest a direction' }).click()
    await expect(assist.getByRole('status')).toContainText('could not be reached')

    await page.unroute('**/api/ai')
    await page.route('**/api/ai', (route) => route.fulfill({ status: 404, contentType: 'text/html', body: '<html>not found</html>' }))
    await assist.getByRole('button', { name: 'Suggest a direction' }).click()
    await expect(assist.getByRole('status')).toContainText('needs the hosted function')
    await expect(page.getByRole('heading', { name: 'Brand direction' })).toBeVisible() // the page is fine
  })

  test('an answer that is not a usable suggestion is refused, even from a function that says ok', async ({ page }) => {
    await mockAi(page, { ok: true, task: 'brand', data: { personality: [], useCases: ['not-a-use'], tones: [] } })
    await createProject(page, 'Bad answer')
    const assist = page.getByTestId('brand-assist')
    await assist.locator('summary').click()
    await assist.getByLabel('Describe the brand in a few sentences').fill('A small roastery that sells coffee by subscription.')
    await assist.getByRole('button', { name: 'Suggest a direction' }).click()
    await expect(assist.getByRole('status')).toContainText('could not be used')
    await expect(page.getByTestId('brand-suggestion')).toHaveCount(0)
  })

  test('the read-only sample cannot be changed by it, and has no way to ask', async ({ page }) => {
    await page.goto('/app/projects/sample-fieldnote')
    const assist = page.getByTestId('brand-assist')
    await assist.locator('summary').click()
    await expect(assist.getByLabel('Describe the brand in a few sentences')).toBeDisabled()
    await expect(assist.getByRole('button', { name: 'Suggest a direction' })).toBeDisabled()
  })

  test('has no serious accessibility violations with the box open and a suggestion showing', async ({ page }) => {
    await mockAi(page, BRAND)
    await createProject(page, 'A11y')
    const assist = page.getByTestId('brand-assist')
    await assist.locator('summary').click()
    await assist.getByLabel('Describe the brand in a few sentences').fill('A small roastery that sells coffee by subscription.')
    await assist.getByRole('button', { name: 'Suggest a direction' }).click()
    await expect(page.getByTestId('brand-suggestion')).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([])
  })
})

test.describe('AI assist: typeface settings', () => {
  test('shows what would change, saves a restore point, applies, and the design follows', async ({ page }) => {
    const sent = await mockAi(page, TYPEFACE)
    await startTypeface(page)
    const assist = page.getByTestId('typeface-assist')
    await assist.locator('summary').click()
    await assist.getByLabel('What should it feel like, and where will it be used?').fill('A warm, slightly rounded display face for a bakery window.')
    await assist.getByRole('button', { name: 'Suggest settings' }).click()
    const suggestion = page.getByTestId('typeface-suggestion')
    await expect(suggestion).toContainText('Family: Geometric')
    await expect(suggestion).toContainText('Corner style: sharp → round')
    await expect(suggestion).toContainText('Terminals: flat → round')
    await expect(suggestion).toContainText('→ 120')
    await expect(suggestion).toContainText('Roundness:')
    await expect(suggestion).toContainText('Chunky and soft.')
    expect(sent).toEqual([{ task: 'typeface', text: 'A warm, slightly rounded display face for a bakery window.' }])
    await saved(page)
    expect((await readProjects(page))[0]!['customTypeface'].dna.family).toBe('geometric') // not applied yet

    await suggestion.getByRole('button', { name: 'Apply to the design' }).click()
    await expect(suggestion).toHaveCount(0)
    await saved(page)
    const face = (await readProjects(page))[0]!['customTypeface']
    expect(face.dna).toMatchObject({ family: 'rounded', strokeThickness: 120, roundness: 0.8, cornerStyle: 'round', terminal: 'round' })
    expect(face.history.some((h: { label: string }) => h.label === 'Before AI suggestion')).toBe(true) // a way back
    const before = face.history.find((h: { label: string }) => h.label === 'Before AI suggestion')
    expect(before.dna.family).toBe('geometric')
  })

  test('says so, and offers nothing to apply, when the suggestion is what the design already has', async ({ page }) => {
    await mockAi(page, { ok: true, task: 'typeface', data: { family: 'geometric', values: {}, rationale: 'Already right.' } })
    await startTypeface(page)
    const assist = page.getByTestId('typeface-assist')
    await assist.locator('summary').click()
    await assist.getByLabel('What should it feel like, and where will it be used?').fill('A plain geometric face for a software company.')
    await assist.getByRole('button', { name: 'Suggest settings' }).click()
    await expect(page.getByTestId('typeface-suggestion')).toContainText('already has')
    await expect(page.getByRole('button', { name: 'Apply to the design' })).toBeDisabled()
  })
})
