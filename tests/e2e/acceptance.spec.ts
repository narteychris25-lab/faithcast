/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { rmSync } from 'node:fs'
import { shots, launch as launchApp, newDataDir } from './helpers'

/**
 * Final acceptance workflow, run against the real built application with an
 * isolated data folder. (A physical second display can't be attached in CI, so
 * the output runs in preview-window mode — the same renderer and IPC path.)
 */

const dataDir = newDataDir()
const launch = () => launchApp(dataDir)

async function outputPage(app: ElectronApplication): Promise<Page> {
  for (let i = 0; i < 50; i++) {
    const p = app.windows().find((w) => w.url().includes('output.html'))
    if (p) return p
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('output window did not open')
}

test.afterAll(() => rmSync(dataDir, { recursive: true, force: true }))

test('full service workflow survives restart', async () => {
  let { app, page } = await launch()

  // 1–2. First-run wizard → church profile
  await expect(page.getByText('Welcome to WorshipFlow')).toBeVisible()
  await page.getByPlaceholder('e.g. Glory House Chapel').fill('Grace Test Church')
  for (let i = 0; i < 4; i++) await page.getByTestId('wizard-next').click()
  await page.getByRole('button', { name: /Classic/ }).first().isVisible()
  // 3. Create a Sunday service (+ demo content for songs/media)
  await page.getByTestId('wizard-finish').click()
  await expect(page.getByText('Welcome, Grace Test Church')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'Service Planner' }).click()
  await expect(page.getByText('This service is empty')).toBeVisible()

  await page.screenshot({ path: `${shots}/00-planner-empty.png` })
  // 4. Three songs
  const songList = page.locator('aside').first()
  for (const title of ['Amazing Grace', 'Holy, Holy, Holy', 'It Is Well with My Soul']) {
    await songList.locator('li').filter({ hasText: title }).first().dblclick()
  }
  // 5. Bible passage
  await songList.getByRole('button', { name: 'Bible', exact: true }).click()
  await songList.getByLabel('Scripture reference').fill('John 3:16-18')
  await songList.getByLabel('Scripture reference').press('Enter')
  // 6. Announcement
  await page.locator('[data-tip^="Add announcement"]').click()
  // 7. Image
  await songList.getByRole('button', { name: 'Image', exact: true }).click()
  await page.locator('aside').first().getByText('Demo — welcome background').dblclick()
  // 8. Video
  await songList.getByRole('button', { name: 'Video', exact: true }).click()
  await page.locator('aside').first().getByText('Demo — motion loop').dblclick()

  const rows = page.locator('[aria-label="Service items"] [data-item-id]')
  await expect(rows).toHaveCount(7)
  await expect(page.getByTestId('save-status')).toHaveText(/Saved/)

  // 9. Arrange: move the announcement to the top
  await rows.filter({ hasText: 'New Announcement' }).click()
  for (let i = 0; i < 5; i++) await page.locator('[aria-label="Service items"]').press('Alt+ArrowUp')
  await expect(rows.first()).toContainText('New Announcement')
  // give the announcement real content
  await page.locator('aside').last().getByRole('textbox').nth(2).fill('YOUTH SERVICE')

  // 10. Theme
  await page.getByRole('button', { name: 'Service settings' }).click()
  await page.locator('aside').last().locator('select').first().selectOption({ label: 'Classic' })
  await expect(page.getByTestId('save-status')).toHaveText(/Saved/)
  await page.screenshot({ path: `${shots}/01-planner.png` })

  // 11–13. Start presentation (preview window stands in for the external display)
  await page.getByRole('button', { name: 'Present' }).click()
  const out = await outputPage(app)
  await expect(page.getByTestId('output-status')).toContainText(/Preview window|Display/)

  // 14. First slide
  await page.keyboard.press('ArrowRight')
  await expect(out.locator('body')).toContainText('YOUTH SERVICE', { timeout: 10_000 })

  // 15–17. Advance through slides into the songs and the Bible passage
  async function advanceUntil(text: string, max = 40) {
    for (let i = 0; i < max; i++) {
      if ((await out.locator('body').innerText()).includes(text)) return
      await page.keyboard.press('Space')
      await page.waitForTimeout(250)
    }
    throw new Error(`never reached slide containing "${text}"`)
  }
  await advanceUntil('Amazing grace')
  await page.screenshot({ path: `${shots}/02-live.png` })
  await out.screenshot({ path: `${shots}/03-output-song.png` })
  await page.keyboard.press('KeyN') // next item shortcut
  await expect(out.locator('body')).toContainText('Holy, holy, holy', { timeout: 5000 })
  await advanceUntil('For God so loved the world')
  await out.screenshot({ path: `${shots}/04-output-bible.png` })

  // 19. Image
  for (let i = 0; i < 20 && !(await out.locator('img[src*="wfmedia://media"]').count()); i++) await page.keyboard.press('Space'), await page.waitForTimeout(250)
  await expect(out.locator('img[src*="wfmedia://media"]').first()).toBeVisible()

  // 20. Video plays
  await page.keyboard.press('Space')
  const video = out.locator('video').first()
  await expect(video).toBeAttached({ timeout: 5000 })
  await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 }).toBeGreaterThan(0.3)
  await out.screenshot({ path: `${shots}/05-output-video.png` })

  // 21–23. Keyboard shortcuts: black out, then resume
  await page.keyboard.press('KeyB')
  await expect(page.getByTestId('ctl-black')).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => out.evaluate(() => [...document.querySelectorAll('div')].some((d) => d.style.background === 'rgb(0, 0, 0)' && d.style.opacity === '1' && d.style.pointerEvents === 'none'))).toBe(true)
  await page.keyboard.press('KeyB')
  await expect(page.getByTestId('ctl-black')).toHaveAttribute('aria-pressed', 'false')

  // 24. End presentation
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'End presentation' }).click()
  await expect.poll(() => app.windows().filter((w) => w.url().includes('output.html')).length).toBe(0)

  // 25. Close
  await app.close()

  // 26–28. Reopen: service, songs, media and settings persisted
  ;({ app, page } = await launch())
  await expect(page.getByText('Welcome, Grace Test Church')).toBeVisible({ timeout: 20_000 })
  const sunday = page.locator('li').filter({ hasText: 'Sunday Service' }).filter({ hasNotText: 'Demo' }).first()
  await expect(sunday).toContainText('7 items')
  await page.getByRole('button', { name: 'Songs', exact: true }).click()
  await expect(page.getByText('Amazing Grace').first()).toBeVisible()
  await page.getByRole('button', { name: 'Media', exact: true }).click()
  await expect(page.getByText('Demo — motion loop')).toBeVisible()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Church' }).click()
  await expect(page.locator('input').first()).toHaveValue('Grace Test Church')
  await app.close()
})
