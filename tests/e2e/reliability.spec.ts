/// <reference lib="dom" />
import { test, expect } from '@playwright/test'
import { copyFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { completeWizard, launch, nav, newDataDir, shots } from './helpers'

const dataDir = newDataDir()
test.afterAll(() => rmSync(dataDir, { recursive: true, force: true }))

test('recovers after a hard crash mid-presentation and tolerates missing media', async () => {
  let { app, page } = await launch(dataDir)
  await completeWizard(page)

  // Missing media: import a copy of a demo image, use it in the service, then delete the file.
  const victim = join(dataDir, 'will-be-deleted.jpg')
  copyFileSync(join(process.cwd(), 'resources/demo/welcome-background.jpg'), victim)
  const serviceId = await page.evaluate(async (path) => {
    const r = await window.fc.invoke('media:import', { paths: [path] })
    const d = await window.fc.invoke('dashboard:get', undefined as never)
    const svc = d.recent.find((s) => s.name === 'Sunday Service (Demo)')!
    await window.fc.invoke('items:add', { serviceId: svc.id, item: { type: 'image', title: 'Deleted Image', data: { mediaId: r.ids[0] } }, position: 0 })
    return svc.id
  }, victim)
  rmSync(victim)

  // Open the demo service in the Live view
  await page.locator('li').filter({ hasText: 'Sunday Service (Demo)' }).first().getByRole('button', { name: 'Present' }).click()
  const svcList = page.locator('ul[aria-label="Service items"]')
  await expect(svcList.getByText('Deleted Image')).toBeVisible()
  await page.getByRole('button', { name: 'Open output' }).click()
  // Go live on the missing image: the app must keep working
  await svcList.getByText('Deleted Image').dblclick()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('ctl-next')).toBeEnabled()
  await expect(page.locator('text=Slide').first()).toBeVisible()
  await page.waitForTimeout(1600) // live snapshot is throttled to once per second
  const liveLabel = await page.locator('footer').innerText()

  // Planner flags the missing file
  await nav(page, 'Service Planner')
  await expect(page.getByText('Media file unavailable').first()).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: `${shots}/20-missing-media.png` })

  // Hard crash
  app.process().kill('SIGKILL')
  await new Promise((r) => setTimeout(r, 1000))

  ;({ app, page } = await launch(dataDir))
  await expect(page.getByText(/recovered from an unexpected shutdown/)).toBeVisible({ timeout: 20_000 })
  await page.screenshot({ path: `${shots}/21-recovery.png` })
  const snap = await page.evaluate(() => window.fc.invoke('app:recovery', undefined as never))
  expect(snap.lastLive?.itemId).toBeTruthy()
  await page.getByRole('button', { name: 'Resume presentation' }).click()
  await expect(page.getByTestId('output-status')).toContainText(/Preview window|Display/)
  await expect(page.locator('footer')).toContainText(/Slide \d+ of/)
  expect(liveLabel).toMatch(/Slide/)
  expect(serviceId).toBeTruthy()
  await app.close()

  // Clean shutdown → no recovery prompt next time
  ;({ app, page } = await launch(dataDir))
  await expect(page.getByText(/Welcome, Grace Test Church/)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/recovered from an unexpected shutdown/)).toHaveCount(0)
  await app.close()
})
