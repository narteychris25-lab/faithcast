/// <reference lib="dom" />
import { test, expect } from '@playwright/test'
import { rmSync } from 'node:fs'
import { completeWizard, launch, nav, newDataDir, shots } from './helpers'

const dataDir = newDataDir()
test.afterAll(() => rmSync(dataDir, { recursive: true, force: true }))

test('light by default; appearance set in Settings applies everywhere, persists, and leaves the audience output unchanged', async () => {
  let { app, page } = await launch(dataDir)
  await completeWizard(page)
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme)
  // Light is the default, and there is no title-bar toggle
  expect(await theme()).toBe('light')
  await expect(page.getByTestId('theme-toggle')).toHaveCount(0)
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(243, 244, 247)')
  await page.screenshot({ path: `${shots}/30-light-dashboard.png` })

  await page.locator('li').filter({ hasText: 'Sunday Service (Demo)' }).first().getByRole('button', { name: 'Open', exact: true }).click()
  await expect(page.locator('[data-item-id]').first()).toBeVisible()
  await page.locator('[data-item-id]').filter({ hasText: 'Amazing Grace' }).click()
  await page.screenshot({ path: `${shots}/31-light-planner.png` })

  await nav(page, 'Live')
  await page.getByRole('button', { name: 'Open output' }).click()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${shots}/32-light-live.png` })
  // The output window keeps a black stage regardless of operator appearance
  const out = app.windows().find((w) => w.url().includes('output.html'))!
  expect(await out.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 0, 0)')

  await nav(page, 'Songs')
  await page.locator('ul[aria-label="Songs"] li').filter({ hasText: 'Amazing Grace' }).click()
  await expect(page.getByLabel('Lyrics')).toBeVisible()
  await page.screenshot({ path: `${shots}/33-light-songs.png` })
  await nav(page, 'Settings')
  await page.screenshot({ path: `${shots}/34-light-settings.png` })

  // Top bar order
  const bar = page.locator('nav[aria-label="Main"]')
  expect(await bar.getByRole('button').evaluateAll((bs) => bs.map((b) => b.textContent!.trim()))).toEqual([
    'Dashboard', 'Bible', 'Songs', 'Themes', 'Service Planner', 'Live', 'Media', 'Internet', 'Settings', 'Help'
  ])

  // Switch to dark in Settings → General; it persists across restart
  await expect(page.locator('#root').getByRole('radio', { name: 'Match macOS' })).toBeVisible()
  await page.locator('#root').getByRole('radio', { name: 'Dark', exact: true }).click()
  await expect.poll(theme).toBe('dark')
  const savedAppearance = () => page.evaluate(() => window.wf.invoke('settings:get', undefined as never).then((s) => s.appearance))
  expect(await savedAppearance()).toBe('dark')
  await page.getByRole('button', { name: 'Close output' }).click().catch(() => undefined)
  await app.close()
  ;({ app, page } = await launch(dataDir))
  await expect(page.getByText('Welcome, Grace Test Church')).toBeVisible({ timeout: 20_000 })
  await expect.poll(theme).toBe('dark')
  await nav(page, 'Settings')
  await page.locator('#root').getByRole('radio', { name: 'Light', exact: true }).click()
  await expect.poll(theme).toBe('light')
  await app.close()
})
