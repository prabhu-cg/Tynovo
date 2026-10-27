import { expect, test, type Locator, type Page } from '@playwright/test'
import { cardAction, createProject } from './helpers'

/**
 * Overlay motion. The drawer slides in over 300ms with a long deceleration and leaves in 160ms; the modal rises from a
 * scrim; under reduced motion both are a plain fade (never nothing). Exits are real: the element stays, inert, until it
 * has finished leaving, and focus has already gone back to the opener.
 */
const anim = (l: Locator) => l.evaluate((e) => { const c = getComputedStyle(e); return { name: c.animationName, ms: Math.round(parseFloat(c.animationDuration) * 1000) } })
const openDrawer = async (page: Page) => {
  await page.goto('/app/projects')
  await page.getByRole('button', { name: /New project|Create your first project/ }).first().click()
  const drawer = page.getByRole('complementary', { name: 'New project' })
  await drawer.waitFor()
  return drawer
}

test.describe('with motion allowed', () => {
  test('the drawer slides and fades in, in about 300ms, and is not instant', async ({ page }) => {
    const drawer = await openDrawer(page)
    expect(await anim(drawer)).toEqual({ name: 'drawer-in', ms: 300 })
    const early = await drawer.evaluate(async (e) => { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const c = getComputedStyle(e); return { opacity: parseFloat(c.opacity), x: new DOMMatrix(c.transform).m41 } })
    expect(early.opacity, 'still fading in a couple of frames after it appeared').toBeLessThan(1)
    expect(early.x, 'still travelling').toBeGreaterThan(0)
    await expect.poll(async () => drawer.evaluate((e) => getComputedStyle(e).opacity)).toBe('1')
  })

  test('the drawer leaves with its own faster animation, stays inert while it goes, and focus is back at once', async ({ page }) => {
    const drawer = await openDrawer(page)
    const opener = page.getByRole('button', { name: /New project|Create your first project/ }).first()
    await page.keyboard.press('Escape')
    await expect(opener).toBeFocused() // not waiting for the animation
    await expect(drawer).toHaveAttribute('data-closing', 'true')
    await expect(drawer).toHaveAttribute('inert', '')
    expect(await anim(drawer)).toEqual({ name: 'drawer-out', ms: 160 })
    await expect(drawer).toHaveCount(0) // and then it is gone
  })

  test('opening again during the exit reopens the same drawer: no duplicates, no stuck state', async ({ page }) => {
    const drawer = await openDrawer(page)
    const opener = page.getByRole('button', { name: /New project|Create your first project/ }).first()
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Escape')
      await opener.click()
    }
    await expect(page.getByRole('complementary', { name: 'New project' })).toHaveCount(1)
    await expect(drawer).not.toHaveAttribute('data-closing')
    await expect(drawer).not.toHaveAttribute('inert', '')
    expect(await drawer.evaluate((e) => e.contains(document.activeElement)), 'focus is inside the reopened drawer').toBe(true)
  })

  test('the modal rises from a scrim that fades up, and both fade out on cancel', async ({ page }) => {
    await createProject(page, 'Motion')
    await page.goto('/app/projects')
    await cardAction(page, 'Motion', /^Delete/)
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    const scrim = page.locator('[data-modal]')
    expect(await anim(dialog)).toEqual({ name: 'modal-in', ms: 240 })
    expect(await anim(scrim)).toEqual({ name: 'scrim-in', ms: 200 })
    await page.keyboard.press('Escape')
    await expect(scrim).toHaveAttribute('data-closing', 'true')
    expect(await anim(dialog)).toEqual({ name: 'modal-out', ms: 140 })
    expect(await anim(scrim)).toEqual({ name: 'scrim-out', ms: 140 })
    await expect(dialog).toHaveCount(0)
  })
})

test.describe('with reduced motion requested', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the drawer fades, it does not slide, in either direction', async ({ page }) => {
    const drawer = await openDrawer(page)
    const enter = await anim(drawer)
    expect(enter.name).toBe('fade-in')
    expect(enter.ms).toBeLessThanOrEqual(200)
    const x = await drawer.evaluate(async (e) => { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return new DOMMatrix(getComputedStyle(e).transform).m41 })
    expect(x, 'no travel').toBe(0)
    await page.keyboard.press('Escape')
    expect((await anim(drawer)).name).toBe('fade-out')
    await expect(drawer).toHaveCount(0)
  })

  test('the modal fades, it does not rise', async ({ page }) => {
    await createProject(page, 'Calm')
    await page.goto('/app/projects')
    await cardAction(page, 'Calm', /^Delete/)
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    expect((await anim(dialog)).name).toBe('fade-in')
    expect(await dialog.evaluate(async (e) => { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return new DOMMatrix(getComputedStyle(e).transform).m42 })).toBe(0)
  })
})
