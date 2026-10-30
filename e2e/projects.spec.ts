import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { cardAction, createProject, saved } from './helpers'

test('dashboard shows an empty state, then a created project', async ({ page }) => {
  await page.goto('/app/projects')
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible()
  await createProject(page, 'First one')
  await page.getByRole('link', { name: 'Projects', exact: true }).first().click()
  await expect(page.getByRole('link', { name: 'First one' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toHaveCount(0)
})

test('the start choice decides which section opens', async ({ page }) => {
  await createProject(page, 'Face first', 'Custom Typeface Creator')
  await expect(page).toHaveURL(/\/typeface$/)
  await expect(page.getByRole('heading', { name: 'Start a typeface' })).toBeVisible()
  await page.goto('/app/projects')
  await createProject(page, 'System first', 'Brand Typography System')
  await expect(page).toHaveURL(/\/typography$/)
})

test('edits autosave and survive a reload', async ({ page }) => {
  await createProject(page, 'Persist me')
  await page.getByLabel('Add a personality trait').fill('precise')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: /Unsaved|Saving/ })).toBeVisible()
  await saved(page)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue('Persist me')
  await expect(page.getByRole('list', { name: 'Personality traits' })).toContainText('precise')
})

test('switching section right after typing still saves the edit', async ({ page }) => {
  await createProject(page, 'Quick')
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('Quick renamed')
  await page.getByRole('link', { name: 'Roles', exact: true }).click() // before the autosave pause elapses
  await expect(page).toHaveURL(/\/typography#roles$/)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue('Quick renamed')
})

test('type scale edits are typed freely and saved', async ({ page }) => {
  await createProject(page, 'Scale', 'Brand Typography System')
  const ratio = page.getByLabel('Ratio')
  await ratio.fill('1.5')
  await expect(page.getByRole('list', { name: 'Scale steps' })).toContainText('Step 1 · 24px')
  await ratio.fill('9') // out of range: not applied, and says why
  await expect(page.getByText('Between 1 and 3')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Scale steps' })).toContainText('Step 1 · 24px')
  await ratio.blur()
  await saved(page)
  await page.reload()
  await expect(page.getByLabel('Ratio')).toHaveValue('1.5')
})

test('rename, duplicate, export, import and delete from the dashboard', async ({ page }) => {
  await createProject(page, 'Lifecycle')
  await page.goto('/app/projects')

  await cardAction(page, 'Lifecycle', 'Rename')
  await page.getByLabel('New name for Lifecycle').fill('Lifecycle 2')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Lifecycle 2', exact: true })).toBeVisible()

  await cardAction(page, 'Lifecycle 2', 'Duplicate')
  await expect(page.getByRole('link', { name: 'Lifecycle 2 (copy)' })).toBeVisible()

  const [download] = await Promise.all([page.waitForEvent('download'), cardAction(page, 'Lifecycle 2', 'Export project file')])
  expect(download.suggestedFilename()).toBe('lifecycle-2.tynovo.json')
  const path = await download.path()
  expect(JSON.parse(readFileSync(path, 'utf8')).project.name).toBe('Lifecycle 2')

  await page.locator('input[type=file]').setInputFiles(path)
  await expect(page.getByText(/Imported as a copy/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Lifecycle 2 (imported)' })).toBeVisible()

  await cardAction(page, 'Lifecycle 2 (imported)', /^Delete/)
  await page.getByRole('button', { name: 'Keep' }).click()
  await expect(page.getByRole('link', { name: 'Lifecycle 2 (imported)' })).toBeVisible()
  await cardAction(page, 'Lifecycle 2 (imported)', /^Delete/)
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Lifecycle 2 (imported)' })).toHaveCount(0)
})

test('project settings: duplicate and delete', async ({ page }) => {
  await createProject(page, 'Settings test')
  await page.getByRole('link', { name: 'Settings', exact: true }).last().click()
  await page.getByRole('button', { name: 'Duplicate this project' }).click()
  await expect(page.getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue('Settings test (copy)')
  await page.getByRole('link', { name: 'Settings', exact: true }).last().click()
  await page.getByRole('button', { name: 'Delete this project…' }).click()
  await page.getByRole('button', { name: 'Delete project' }).click()
  await expect(page).toHaveURL(/\/app\/projects$/)
  await expect(page.getByRole('link', { name: 'Settings test (copy)' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Settings test', exact: true })).toBeVisible()
})

test('rejects a file that is not a project and stores nothing', async ({ page }, info) => {
  await page.goto('/app/projects')
  const bad = info.outputPath('bad.json')
  writeFileSync(bad, '{"hello":"world"}')
  await page.locator('input[type=file]').setInputFiles(bad)
  await expect(page.getByRole('alert')).toContainText('not a Tynovo project file')
})

test('a failing save keeps the edits, offers recovery, and recovers when storage works again', async ({ page }) => {
  await createProject(page, 'Fragile')
  await saved(page)
  // Make every write fail like a full disk.
  await page.evaluate(() => {
    const real = IDBObjectStore.prototype.put
    ;(window as unknown as { __restore: () => void }).__restore = () => (IDBObjectStore.prototype.put = real)
    IDBObjectStore.prototype.put = () => {
      throw new DOMException('quota', 'QuotaExceededError')
    }
  })
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('Fragile edited')
  const alert = page.getByRole('alert').filter({ hasText: 'Could not save' })
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('storage is full')
  await expect(page.getByRole('status').filter({ hasText: 'Could not save' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue('Fragile edited')

  const [dl] = await Promise.all([page.waitForEvent('download'), alert.getByRole('button', { name: 'Download project file' }).click()])
  expect(JSON.parse(readFileSync(await dl.path(), 'utf8')).project.name).toBe('Fragile edited') // recovered from memory

  await page.evaluate(() => (window as unknown as { __restore: () => void }).__restore())
  await alert.getByRole('button', { name: 'Try again' }).click()
  await saved(page)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue('Fragile edited')
})

test('leaving while a save is failing asks first', async ({ page }) => {
  await createProject(page, 'Stuck')
  await saved(page)
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException('quota', 'QuotaExceededError')
    }
  })
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('Stuck edited')
  await expect(page.getByRole('alert').filter({ hasText: 'Could not save' })).toBeVisible()
  await page.getByRole('link', { name: 'Projects', exact: true }).first().click()
  await expect(page.getByText('Your latest changes are not saved')).toBeVisible()
  await page.getByRole('button', { name: 'Stay' }).click()
  await expect(page.getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue('Stuck edited')
})

test('two tabs: autosave stops instead of overwriting, and offers a copy', async ({ page, context }) => {
  await createProject(page, 'Conflict')
  await saved(page)
  const url = page.url()
  const other = await context.newPage()
  await other.goto(url)
  await other.getByRole('textbox', { name: 'Project name', exact: true }).fill('Conflict from tab B')
  await expect(other.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible()

  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('Conflict from tab A')
  await expect(page.getByRole('alert')).toContainText('changed somewhere else')
  await page.getByRole('button', { name: 'Save mine as a copy' }).click()
  await expect(page).not.toHaveURL(url)
  await expect(page.getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue('Conflict from tab A (copy)')
  await page.goto('/app/projects')
  await expect(page.getByRole('link', { name: 'Conflict from tab B' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Conflict from tab A (copy)' })).toBeVisible()
})

test('an unreadable record is kept and offered for recovery', async ({ page }) => {
  await page.goto('/app/projects')
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible() // the app has opened (and created) its database
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('brand-typography-studio', 1)
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const tx = req.result.transaction('projects', 'readwrite')
          tx.objectStore('projects').put({ id: 'broken-1', schemaVersion: 1, name: '' })
          tx.oncomplete = () => resolve()
        }
      }),
  )
  await page.reload()
  await expect(page.getByText('Records that could not be opened')).toBeVisible()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download raw data' }).click()])
  expect(JSON.parse(readFileSync(await dl.path(), 'utf8')).id).toBe('broken-1')
})

test('a missing project explains itself', async ({ page }) => {
  await page.goto('/app/projects/does-not-exist')
  await expect(page.getByRole('alert')).toContainText('does not exist')
  await page.getByRole('link', { name: 'Back to projects' }).click()
  await expect(page).toHaveURL(/\/app\/projects$/)
})
