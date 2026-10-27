import { expect, test, type Page } from '@playwright/test'
import { createProject, readProjects } from './helpers'

/**
 * Browser storage fails in ordinary ways: private windows, blocked site data, a full disk, a second tab. None of them may
 * lose a person's work silently, and each must say what happened in words.
 */

/** Make IndexedDB writes throw QuotaExceededError while `window.__diskFull` is true. */
const diskCanFill = (page: Page) =>
  page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if ((window as unknown as { __diskFull?: boolean }).__diskFull) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      return put.apply(this, args)
    }
  })

const setDisk = (page: Page, full: boolean) => page.evaluate((f) => ((window as unknown as { __diskFull: boolean }).__diskFull = f), full)

test.describe('storage quota exhausted', () => {
  test('the edit stays on screen, the failure is announced, a copy can be downloaded, and saving works again once there is room', async ({ page }) => {
    await diskCanFill(page)
    await createProject(page, 'Roomy')
    await setDisk(page, true)

    const name = page.getByRole('main').getByRole('textbox', { name: 'Project name', exact: true })
    await name.fill('Roomy, renamed')
    await expect(page.getByRole('status').filter({ hasText: 'Could not save' })).toBeVisible()
    const alert = page.getByRole('alert').filter({ hasText: 'Could not save.' })
    await expect(alert).toContainText('Browser storage is full')
    await expect(alert).toContainText('Your edits are still on this screen')
    await expect(alert).toContainText('Error') // said in words, not only in colour
    await expect(name).toHaveValue('Roomy, renamed')

    // Nothing partial was written: the stored project is still the old one.
    expect((await readProjects(page))[0]!['name']).toBe('Roomy')

    // The person can take their work with them while storage is full.
    const [download] = await Promise.all([page.waitForEvent('download'), alert.getByRole('button', { name: 'Download project file' }).click()])
    expect(download.suggestedFilename()).toBe('roomy-renamed.tynovo.json')

    await setDisk(page, false)
    await alert.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'Could not save.' })).toHaveCount(0)
    expect((await readProjects(page))[0]!['name']).toBe('Roomy, renamed')
  })

  test('creating a project while storage is full says so and creates nothing', async ({ page }) => {
    await diskCanFill(page)
    await page.goto('/app/projects')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await setDisk(page, true)
    await page.getByRole('button', { name: /New project|Create your first project/ }).first().click()
    const drawer = page.getByRole('complementary', { name: 'New project' })
    await drawer.getByLabel('Project name').fill('Will not fit')
    await drawer.getByRole('button', { name: 'Create project' }).click()
    await expect(drawer.getByRole('alert')).toContainText('Browser storage is full')
    await expect(drawer.getByRole('button', { name: 'Create project' })).toBeEnabled() // not stuck on "Creating…"
    expect(await readProjects(page)).toEqual([])
  })
})

test.describe('storage unavailable (private window, blocked site data)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }))
  })

  test('the app still works for the session and says plainly that nothing will be kept', async ({ page }) => {
    await page.goto('/app/projects')
    const warning = page.getByRole('alert').filter({ hasText: 'Browser storage is unavailable' })
    await expect(warning).toContainText('will be gone when you close this tab')
    await expect(warning).toContainText('Export a project file')
    await expect(warning).toContainText('Warning')

    await page.getByRole('button', { name: /New project|Create your first project/ }).first().click()
    const drawer = page.getByRole('complementary', { name: 'New project' })
    await drawer.getByLabel('Project name').fill('Session only')
    await drawer.getByRole('button', { name: 'Create project' }).click()
    await expect(page).toHaveURL(/\/app\/projects\/[^/]+/)
    await expect(page.getByRole('main').getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue('Session only')
    await expect(page.getByText('Storage: memory only')).toBeVisible()
  })
})

test.describe('restart and interruption', () => {
  test('an edit made just before the tab is hidden is saved, and is there after a reload', async ({ page }) => {
    await createProject(page, 'Interrupted')
    await page.getByRole('main').getByRole('textbox', { name: 'Project name', exact: true }).fill('Interrupted, edited')
    // Hide the tab straight away, long before the 1.2 s autosave would have fired.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect.poll(async () => (await readProjects(page))[0]!['name']).toBe('Interrupted, edited')
    await page.reload()
    await expect(page.getByRole('main').getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue('Interrupted, edited')
  })

  test('closing a new browser context loses nothing that was saved: a fresh page reads the project back from storage', async ({ page }) => {
    await createProject(page, 'Restart')
    await page.getByLabel('Add a personality trait').fill('steady')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible()
    const url = page.url()
    await page.goto('about:blank')
    await page.goto(url)
    await expect(page.getByRole('list', { name: 'Personality traits' })).toContainText('steady')
  })

  test('the same project open in two tabs: the second save is refused and nothing is overwritten', async ({ page, context }) => {
    await createProject(page, 'Twin')
    const other = await context.newPage()
    await other.goto(page.url())
    await expect(other.getByRole('main').getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue('Twin')

    await page.getByRole('main').getByRole('textbox', { name: 'Project name', exact: true }).fill('Twin, first tab')
    await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible()

    await other.getByRole('main').getByRole('textbox', { name: 'Project name', exact: true }).fill('Twin, second tab')
    await expect(other.getByRole('alert').filter({ hasText: 'changed somewhere else' })).toBeVisible()
    expect((await readProjects(page))[0]!['name']).toBe('Twin, first tab')
  })
})
