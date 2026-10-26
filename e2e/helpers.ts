import { expect, type Page } from '@playwright/test'

/** Create a project through the New project drawer and land in it. */
export async function createProject(page: Page, name: string, start: 'Overview' | 'Brand Typography System' | 'Custom Typeface Creator' = 'Overview') {
  await page.goto('/app/projects')
  await page.getByRole('button', { name: /New project|Create your first project/ }).first().click()
  const drawer = page.getByRole('complementary', { name: 'New project' })
  await drawer.getByLabel('Project name').fill(name)
  await drawer.getByRole('radio', { name: new RegExp(start) }).check()
  await drawer.getByRole('button', { name: 'Create project' }).click()
  await expect(page).toHaveURL(/\/app\/projects\/[^/]+/) // navigated into the new project (the drawer has a field with the same name)
  await expect(page.getByRole('main').getByRole('textbox', { name: 'Project name', exact: true })).toHaveValue(name)
}

export const saved = (page: Page) => expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible()

/** Read every stored project straight from IndexedDB (raw rows, as the app wrote them). */
export function readProjects(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Array<Record<string, any>>>((resolve, reject) => {
        const req = indexedDB.open('brand-typography-studio', 1)
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const g = req.result.transaction('projects').objectStore('projects').getAll()
          g.onsuccess = () => resolve(g.result)
        }
      }),
  )
}

/** Replace stored rows with the given objects (put by id). Used to plant old-version or deliberately broken data. */
export function writeProjects(page: Page, rows: Array<Record<string, unknown>>) {
  return page.evaluate(
    (data) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('brand-typography-studio', 1)
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const tx = req.result.transaction('projects', 'readwrite')
          for (const row of data) tx.objectStore('projects').put(row)
          tx.oncomplete = () => resolve()
        }
      }),
    rows,
  )
}

/** Open a project card's "More actions" menu and choose an action. */
export async function cardAction(page: Page, project: string, action: string | RegExp) {
  await page.getByRole('button', { name: `More actions for ${project}`, exact: true }).click()
  await page.getByRole('menu', { name: `More actions for ${project}` }).getByRole('menuitem', { name: action }).click()
}
